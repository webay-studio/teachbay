import type {
  PdfAnalysisPage,
  PdfAnalysisResult,
  PdfAnalysisOptions,
} from "./types";
import {
  ocrResults,
  ocrPixelKey,
  type CachedOCRLine,
} from "./ocr-result-cache";
import { assignDocumentOwnership } from "./document-ownership";
import { validateQuestionNumbers, readQuestionNumber } from "./question-number";
import { numberRetryCrops } from "./ocr-retries";
import { acquireOCR } from "./ocr-worker";
import { pdfGeometry, pdfRasterContainers } from "./pdf-geometry";
import { physicalRegions } from "./physical";
import { combineRegions } from "./hybrid-regions";
import { findInkRegions } from "./ink-regions";
import { suppressColoredInk, type InkStats } from "./ink-preprocess";
import { suppressIsolatedInk, type ShapeInkReport } from "./shape-ink-filter";
import { nativeObservation, assessNativeFonts } from "./native-observations";
import type { Observation } from "./question-regions";
import type { Matrix3 } from "./base-types";
import type { ImageAsset } from "./base-types";
import { canvasAsset, checkCancelled } from "./browser-utils";
import { abortable } from "./cancel";
import { joinLines } from "./text-lines";
import type { ImportProgress, TextLine, Rect } from "./base-types";
import { buildStructure, type EvidenceLine } from "./structure";
export async function analyzePdf(
  file: File,
  signal: AbortSignal,
  progress: (p: ImportProgress) => void,
  options: PdfAnalysisOptions = { removeInk: true, shapeFilter: true },
): Promise<PdfAnalysisResult> {
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf")
    throw new Error("이 실험 페이지에는 PDF만 올릴 수 있습니다.");
  if (file.size > 50 * 1024 * 1024)
    throw new Error("50MB 이하의 PDF를 선택해주세요.");
  const pdfjs = await import("pdfjs-dist"),
    { createWorker, PSM } = await import("tesseract.js"),
    runtime = "/document-runtime";
  pdfjs.GlobalWorkerOptions.workerSrc = `${runtime}/pdf.worker.min.mjs`;
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    cMapUrl: `${runtime}/pdf/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${runtime}/pdf/standard_fonts/`,
    wasmUrl: `${runtime}/pdf/wasm/`,
  });
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined,
    workerLoadMs = 0;
  let lease: Awaited<ReturnType<typeof acquireOCR>> | undefined;
  const cancel = () => {
    void task.destroy();
    void lease?.release(true);
  };
  signal.addEventListener("abort", cancel, { once: true });
  const pages: PdfAnalysisPage[] = [],
    lines: EvidenceLine[] = [];
  const ocrPolicy = options.ocrPolicy ?? "legacy";
  try {
    const pdf = await abortable(task.promise, signal);
    if (options.maxPages && pdf.numPages > options.maxPages)
      throw new Error(
        `한 번에 최대 ${options.maxPages}쪽까지 분석할 수 있습니다. 문서를 나눠 올려주세요.`,
      );
    for (let index = 0; index < pdf.numPages; index++) {
      checkCancelled(signal);
      const started = performance.now();
      const page = await pdf.getPage(index + 1),
        base = page.getViewport({ scale: 1 }),
        viewport = page.getViewport({
          scale: Math.min(2.5, 2200 / base.width, 3200 / base.height),
        });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      const [a, b, c, d, e, f] = viewport.transform,
        sourceToAnalysis: Matrix3 = [a, c, e, b, d, f, 0, 0, 1];
      progress({
        current: index,
        total: pdf.numPages,
        message: `${index + 1}/${pdf.numPages}쪽 · 원본 렌더링`,
        stage: "rendering",
      });
      await abortable(page.render({ canvas, viewport }).promise, signal);
      const originalAsset = await canvasAsset(canvas),
        before = ctx.getImageData(0, 0, canvas.width, canvas.height);
      options.onPageRendered?.({ index, asset: originalAsset });
      const renderMs = performance.now() - started;
      progress({
        current: index,
        total: pdf.numPages,
        message: `${index + 1}/${pdf.numPages}쪽 · 문제 영역 분석`,
        stage: "locating",
      });
      let annotationCount = 0,
        stats: InkStats | undefined;
      if (options.removeInk) {
        annotationCount = (await page.getAnnotations({ intent: "display" }))
          .length;
        if (annotationCount)
          await abortable(
            page.render({
              canvas,
              viewport,
              annotationMode: pdfjs.AnnotationMode.DISABLE,
            }).promise,
            signal,
          );
        stats = await suppressColoredInk(canvas, signal);
      }
      const after = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let analysisAsset = options.removeInk
        ? await canvasAsset(canvas)
        : undefined;
      const detectedLanes = physicalRegions(
        after.data,
        canvas.width,
        canvas.height,
      );
      let inkPoints = await findInkRegions(
          canvas,
          signal,
          false,
          options.connectivity ?? 4,
        ),
        inkRegions = inkPoints;
      const nativeStarted = performance.now(),
        observations: Observation[] = [],
        pageLines: EvidenceLine[] = [];
      const content = options.distributionOnly
        ? { items: [], styles: {} }
        : await page.getTextContent();
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const t = pdfjs.Util.transform(viewport.transform, item.transform),
          font = (
            content.styles as Record<
              string,
              { ascent?: number; descent?: number; fontFamily?: string }
            >
          )[item.fontName];
        const th = Math.hypot(t[2], t[3]),
          tw = item.width * viewport.scale,
          angle = Math.atan2(t[1], t[0]);
        const ux = Math.cos(angle),
          uy = Math.sin(angle),
          vx = -uy,
          vy = ux;
        const asc = Number.isFinite(font?.ascent) ? font!.ascent! : 0.85,
          desc = Number.isFinite(font?.descent) ? font!.descent! : -0.2;
        const corners = [
          [0, -asc * th],
          [tw, -asc * th],
          [tw, -desc * th],
          [0, -desc * th],
        ].map(([x, y]) => [t[4] + ux * x + vx * y, t[5] + uy * x + vy * y]);
        const x = Math.min(...corners.map((p) => p[0])),
          y = Math.min(...corners.map((p) => p[1]));
        const rect = {
          x: x / canvas.width,
          y: y / canvas.height,
          w: (Math.max(...corners.map((p) => p[0])) - x) / canvas.width,
          h: (Math.max(...corners.map((p) => p[1])) - y) / canvas.height,
        };
        observations.push(
          nativeObservation({
            id: crypto.randomUUID(),
            text: item.str,
            pageIndex: index,
            rect,
            transform: sourceToAnalysis,
            fontName: item.fontName,
            fontFamily: font?.fontFamily,
            before,
            after,
          }),
        );
      }
      assessNativeFonts(observations);
      const native = joinLines(
        observations.map((o) => ({
          ...o.rect,
          text: o.text,
          confidence: o.state === "supported" ? 100 : 0,
        })),
      );
      const supported = observations.filter((o) => o.state === "supported");
      const joinNative = joinLines(
        supported.map((o) => ({ ...o.rect, text: o.text, confidence: 100 })),
      );
      for (const l of joinNative) {
        const ids = supported
          .filter(
            (o) =>
              o.rect.x >= l.x - 0.002 &&
              o.rect.x + o.rect.w <= l.x + l.w + 0.002 &&
              Math.abs(o.rect.y - l.y) < l.h,
          )
          .map((o) => o.id);
        pageLines.push({
          ...l,
          id: crypto.randomUUID(),
          page: index,
          source: "pdf",
          passId: `native-${index}`,
          observationIds: ids,
          role: "unassigned",
          reasons: [],
        });
      }
      const operators = await page.getOperatorList();
      const containers = pdfRasterContainers(
        operators,
        pdfjs.OPS,
        viewport.transform,
        canvas.width,
        canvas.height,
      );
      const horizontalRules: Rect[] = [];
      const visualRegions = observations.length
        ? pdfGeometry(
            operators,
            pdfjs.OPS,
            viewport.transform,
            canvas.width,
            canvas.height,
            horizontalRules,
          )
        : [];
      visualRegions.push(
        ...containers
          .filter((c) => c.rect.w < 0.85 && c.rect.h < 0.85)
          .map((c) => c.rect),
      );
      const nativeMs = performance.now() - nativeStarted;
      // Region-level OCR scheduling: a clean native column does not incur OCR.
      const regions = detectedLanes.length
        ? detectedLanes
        : [{ x: 0, y: 0, w: 1, h: 1 }];
      const clean = (r: Rect) => {
        const os = observations.filter(
          (o) =>
            o.rect.x >= r.x &&
            o.rect.x + o.rect.w <= r.x + r.w &&
            o.rect.y > 0.12 &&
            o.rect.y < 0.9,
        );
        const good = os.filter((o) => o.state === "supported");
        return (
          good.length >= 12 &&
          good.map((o) => o.text).join("").length >= 60 &&
          good.length / Math.max(1, os.length) > 0.8
        );
      };
      const sourceKind: PdfAnalysisPage["sourceKind"] = !observations.length
        ? "scan"
        : regions.every(clean)
          ? "native"
          : "mixed";
      const warnings: string[] = [];
      if (options.removeInk)
        warnings.push(
          "색상 전처리는 인쇄된 색상도 바꿀 수 있습니다. 형태 단계는 픽셀을 삭제하지 않는 분류입니다.",
        );
      if (
        observations.some(
          (o) => o.removedInkRatio > 0.1 && o.state === "supported",
        )
      )
        warnings.push(
          "전처리와 충돌한 네이티브 인쇄 글자를 원본 근거로 보존했습니다. 원본 이미지와 비교하세요.",
        );
      const ocrCrops: PdfAnalysisPage["coordinateFrames"]["ocrCrops"] = [];
      let ocrMs = 0,
        ocrPasses = 0,
        ocrRecognitions = 0,
        ocrCacheHits = 0,
        ocrCacheMs = 0;
      const recognize = async (
        r: Rect,
        mode:
          typeof PSM.AUTO | typeof PSM.SPARSE_TEXT | typeof PSM.SINGLE_BLOCK,
        highResolution = false,
        digitsOnly = false,
      ) => {
        const t = performance.now(),
          crop = document.createElement("canvas"),
          sx = Math.floor(r.x * canvas.width),
          sy = Math.floor(r.y * canvas.height);
        crop.width = Math.max(
          1,
          Math.min(canvas.width - sx, Math.ceil(r.w * canvas.width)),
        );
        crop.height = Math.max(
          1,
          Math.min(canvas.height - sy, Math.ceil(r.h * canvas.height)),
        );
        const factor = highResolution ? 2 : 1;
        crop.width = Math.max(1, Math.round(crop.width * factor));
        crop.height = Math.max(1, Math.round(crop.height * factor));
        if (highResolution) {
          // Re-render from PDF/original scan; do not magnify the analysis bitmap.
          await abortable(
            page.render({
              canvas: crop,
              viewport: page.getViewport({ scale: viewport.scale * factor }),
              transform: [1, 0, 0, 1, -sx * factor, -sy * factor],
              annotationMode: options.removeInk
                ? pdfjs.AnnotationMode.DISABLE
                : pdfjs.AnnotationMode.ENABLE,
            }).promise,
            signal,
          );
          if (options.removeInk) await suppressColoredInk(crop, signal);
        } else
          crop
            .getContext("2d")!
            .drawImage(
              canvas,
              sx,
              sy,
              crop.width,
              crop.height,
              0,
              0,
              crop.width,
              crop.height,
            );
        const passId = `ocr-${index}-${ocrPasses++}${highResolution ? "-roi-original-2x" : ""}`,
          toCanvas: Matrix3 = [1 / factor, 0, sx, 0, 1 / factor, sy, 0, 0, 1];
        ocrCrops.push({ passId, rect: r, toCanvas });
        const wholePage = r.x === 0 && r.y === 0 && r.w === 1 && r.h === 1;
        const ocrStage: ImportProgress["stage"] = digitsOnly
          ? "ocr-pagination"
          : highResolution
            ? "ocr-number-zoom"
            : mode === PSM.SPARSE_TEXT
              ? wholePage
                ? "ocr-detail"
                : "ocr-number-check"
              : wholePage
                ? "ocr-page"
                : "ocr-column";
        const reportOCR = (stage: ImportProgress["stage"] = ocrStage) =>
          progress({
            current: index,
            total: pdf.numPages,
            message: `${index + 1}/${pdf.numPages}쪽 · 필요한 영역 OCR (${ocrPasses})`,
            stage,
          });
        try {
          reportOCR();
          checkCancelled(signal);
          const cacheStarted = performance.now();
          const cacheKey = globalThis.crypto?.subtle
            ? await ocrPixelKey(
                crop
                  .getContext("2d")!
                  .getImageData(0, 0, crop.width, crop.height).data,
                crop.width,
                crop.height,
                mode,
                digitsOnly,
              )
            : undefined;
          let recognizedLines = cacheKey ? ocrResults.get(cacheKey) : undefined;
          ocrCacheMs += performance.now() - cacheStarted;
          checkCancelled(signal);
          if (recognizedLines) {
            ocrCacheHits++;
            reportOCR("ocr-reuse");
          } else {
            if (!worker) {
              reportOCR("ocr-loading");
              lease = await acquireOCR(signal);
              worker = lease.worker;
              workerLoadMs += lease.loadMs;
              reportOCR();
            }
            await worker.setParameters({
              tessedit_pageseg_mode: mode,
              tessedit_char_whitelist: digitsOnly ? "0123456789" : "",
            });
            const { data } = await abortable(
              worker.recognize(crop, {}, { blocks: true, text: true }),
              signal,
            );
            ocrRecognitions++;
            checkCancelled(signal);
            recognizedLines = [] as CachedOCRLine[];
            for (const block of data.blocks ?? [])
              for (const para of block.paragraphs)
                for (const line of para.lines)
                  recognizedLines.push({
                    text: line.text,
                    confidence: line.confidence,
                    bbox: line.bbox,
                    words: line.words.map((word) => ({
                      text: word.text,
                      confidence: word.confidence,
                      bbox: word.bbox,
                    })),
                  });
            if (cacheKey) ocrResults.set(cacheKey, recognizedLines);
          }
          // Preserve the original pass order, IDs, coordinates and all evidence.
          for (const line of recognizedLines) {
            const ids: string[] = [];
            for (const word of line.words) {
              const rect = {
                x: (sx + word.bbox.x0 / factor) / canvas.width,
                y: (sy + word.bbox.y0 / factor) / canvas.height,
                w: (word.bbox.x1 - word.bbox.x0) / factor / canvas.width,
                h: (word.bbox.y1 - word.bbox.y0) / factor / canvas.height,
              };
              const id = crypto.randomUUID();
              ids.push(id);
              observations.push({
                id,
                source: "ocr",
                passId,
                pageIndex: index,
                flowRegionId: "unassigned",
                transform: toCanvas,
                confidence: word.confidence,
                rect,
                text: word.text,
                state: "supported",
                geometryStatus: "usable",
                textStatus: "usable",
                issues: [],
                inkSupport: 0,
                removedInkRatio: 0,
              });
            }
            pageLines.push({
              id: crypto.randomUUID(),
              page: index,
              source: "ocr",
              passId,
              observationIds: ids,
              role: "unassigned",
              reasons: [],
              text: line.text,
              confidence: line.confidence,
              x: (sx + line.bbox.x0 / factor) / canvas.width,
              y: (sy + line.bbox.y0 / factor) / canvas.height,
              w: (line.bbox.x1 - line.bbox.x0) / factor / canvas.width,
              h: (line.bbox.y1 - line.bbox.y0) / factor / canvas.height,
            });
          }
        } finally {
          crop.width = crop.height = 1;
          ocrMs += performance.now() - t;
        }
      };
      if (!options.distributionOnly)
        try {
          if (ocrPolicy === "legacy" && !regions.every(clean)) {
            await recognize({ x: 0, y: 0, w: 1, h: 1 }, PSM.AUTO);
            await recognize({ x: 0, y: 0, w: 1, h: 1 }, PSM.SPARSE_TEXT);
            if (detectedLanes.length > 1)
              for (const r of detectedLanes) await recognize(r, PSM.AUTO);
          } else if (ocrPolicy === "adaptive")
            for (const r of regions.filter((r) => !clean(r))) {
              await recognize(r, PSM.AUTO);
              const read = pageLines.filter(
                (l) =>
                  l.source === "ocr" && l.x >= r.x && l.x + l.w <= r.x + r.w,
              );
              // One bounded retry if there are no usable starts; never repeat all passes by default.
              if (!read.some((l) => /^\s*\d{1,3}[.번]/.test(l.text)))
                await recognize(r, PSM.SPARSE_TEXT);
            }
          if (sourceKind !== "native") {
            if (ocrPolicy === "legacy") {
              // Retry only lanes with no usable start or contradictory jumps.
              // This is one additional pass per lane, not recursive retries.
              for (const r of regions.slice(0, 2)) {
                const laneLines = pageLines.filter(
                  (l) =>
                    l.x >= r.x &&
                    l.x + l.w <= r.x + r.w &&
                    !/학년|학기|고사|교시|저작권/.test(l.text),
                );
                const hs = laneLines
                  .filter((l) => /[가-힣]{2}/.test(l.text) && l.h < 0.04)
                  .map((l) => l.h)
                  .sort((a, b) => a - b);
                const anchors = validateQuestionNumbers(
                  laneLines,
                  r,
                  hs[Math.floor(hs.length / 2)] || 0.015,
                ).anchors;
                const ns = anchors.map((l) =>
                  Number(readQuestionNumber(l.text)),
                );
                if (
                  !ns.length ||
                  ns.some((n, i) => i > 0 && n !== ns[i - 1] + 1)
                )
                  await recognize(r, PSM.SPARSE_TEXT);
              }
            }
            for (const crop of numberRetryCrops(pageLines, regions))
              await recognize(crop, PSM.SINGLE_BLOCK, true);
            // Header pagination is metadata. OCR only an observed, large outer-header
            // glyph box when no readable word supports it; never infer it from page index.
            const header = observations
              .filter(
                (o) =>
                  o.source === "pdf" &&
                  o.geometryStatus === "usable" &&
                  o.rect.y < 0.12 &&
                  (o.rect.x < 0.2 || o.rect.x > 0.8) &&
                  o.rect.h > 0.015 &&
                  o.rect.w < 0.1,
              )
              .sort((a, b) => b.rect.h - a.rect.h)[0];
            if (
              header &&
              !observations.some(
                (o) =>
                  o.source === "ocr" &&
                  /^\d{1,3}$/.test(o.text) &&
                  o.rect.h > header.rect.h * 0.6 &&
                  Math.abs(o.rect.y - header.rect.y) < 0.01 &&
                  (o.confidence ?? 0) > 60,
              )
            ) {
              const r = header.rect,
                x = Math.max(0, r.x - 0.006),
                y = Math.max(0, r.y - 0.005);
              await recognize(
                {
                  x,
                  y,
                  w: Math.min(1 - x, r.w + 0.012),
                  h: Math.min(1 - y, r.h + 0.01),
                },
                PSM.SINGLE_BLOCK,
                true,
                true,
              );
            }
          }
        } catch (error) {
          checkCancelled(signal);
          warnings.push(
            `OCR 일부 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
          );
        }
      let colorAsset: ImageAsset | undefined,
        shapeMaskAsset: ImageAsset | undefined,
        shapeReport: ShapeInkReport | undefined;
      const shapeStarted = performance.now();
      if (
        options.removeInk &&
        options.shapeFilter &&
        !options.distributionOnly
      ) {
        progress({
          current: index,
          total: pdf.numPages,
          message: `${index + 1}/${pdf.numPages}쪽 · 형태 분류`,
          stage: "shape-check",
        });
        colorAsset = analysisAsset;
        const filtered = await suppressIsolatedInk(
          canvas,
          inkPoints,
          pageLines,
          signal,
          regions,
          false,
        );
        shapeReport = filtered.report;
        try {
          shapeMaskAsset = await canvasAsset(filtered.overlay);
        } finally {
          filtered.overlay.width = filtered.overlay.height = 1;
        }
      }
      const shapeMs = performance.now() - shapeStarted;
      // Original geometry remains available when color deletion collides with native print.
      if (supported.some((o) => o.removedInkRatio > 0.1)) {
        const original = document.createElement("canvas");
        original.width = canvas.width;
        original.height = canvas.height;
        original.getContext("2d")!.putImageData(before, 0, 0);
        try {
          inkPoints = await findInkRegions(
            original,
            signal,
            false,
            options.connectivity ?? 4,
          );
          inkRegions = inkPoints;
        } finally {
          original.width = original.height = 1;
        }
      }
      pages.push({
        id: crypto.randomUUID(),
        index,
        asset: originalAsset,
        analysisAsset,
        colorAsset,
        shapeMaskAsset,
        shapeReport,
        beforeShapeLines: [...pageLines],
        observations,
        visualRegions,
        containers,
        horizontalRules,
        sourceKind,
        timings: {
          renderMs,
          nativeMs,
          ocrMs,
          shapeMs,
          totalMs: performance.now() - started,
          ocrPasses,
          ocrRecognitions,
          ocrCacheHits,
          ocrCacheMs,
        },
        coordinateFrames: {
          rotation: page.rotate,
          cropBox: [...page.view],
          viewportToCanvas: [1, 0, 0, 0, 1, 0, 0, 0, 1],
          componentScale: Math.min(1, 1200 / canvas.width),
          ocrCrops,
        },
        preprocessing: {
          enabled: options.removeInk,
          annotationCount,
          stats,
          nativeLinesExcluded: observations.filter(
            (o) => o.source === "pdf" && o.state === "held",
          ).length,
        },
        nativeLines: native,
        inkRegions,
        inkPoints,
        regions: detectedLanes,
        lines: pageLines,
        sourceToAnalysis,
        method: sourceKind === "native" ? "text" : ocrPasses ? "ocr" : "unread",
        warnings,
      });
      lines.push(...pageLines);
      canvas.width = canvas.height = 1;
      page.cleanup();
      progress({
        current: index + 1,
        total: pdf.numPages,
        message: `${index + 1}/${pdf.numPages}쪽 · 관측 확보 완료`,
        stage: "page-ready",
      });
    }
    progress({
      current: pdf.numPages,
      total: pdf.numPages,
      message: "페이지 간 문항·지문 연결 분석",
      stage: "assembling",
    });
    const structure = options.distributionOnly
      ? { lines: [], groups: [], relations: [] }
      : buildStructure(lines, pages.length, []);
    const result = options.distributionOnly
      ? structure
      : assignDocumentOwnership(combineRegions(structure, pages), pages);
    return {
      ...result,
      distributionOnly: !!options.distributionOnly,
      pages,
      filename: file.name,
      version: "text-structure-v3",
      workerLoadMs,
      ocrPolicy,
      description:
        "원본 대응 검증 → 네이티브/필요 영역 OCR → 비파괴 형태 분류 → 블록 소속 → 읽기 영역 간 논리 문항 연결",
    };
  } finally {
    signal.removeEventListener("abort", cancel);
    await lease?.release(signal.aborted);
    await task.destroy().catch(() => {});
  }
}
