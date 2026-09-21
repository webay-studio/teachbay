import { recognizeRegions } from "./ocr";
import type { ImageAsset } from "../types";
import type {
  DocumentPage,
  ImportedDocument,
  ImportProgress,
  TextLine,
} from "./types";
import { joinLines, segmentDocument } from "./segment";
import { usableText } from "./physical";
import { analyzePixels } from "./analyze-pixels";
import type { Matrix3 } from "./registration-graph";
import { abortable } from "./cancel";
import type { Worker as OcrWorker } from "tesseract.js";
const runtime = "/document-runtime";
export const DOCUMENT_ACCEPT = ".pdf,.hwp,.hwpx";
export const isDocument = (file: File) =>
  /\.(pdf|hwp|hwpx)$/i.test(file.name) || file.type === "application/pdf";
import {
  canvasAsset,
  checkCancelled,
} from "../pdf-region-engine/browser-utils";
export {
  canvasAsset,
  checkCancelled,
} from "../pdf-region-engine/browser-utils";
export async function imageFromBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}
let hwpInit: Promise<typeof import("@rhwp/core")> | undefined;
export async function hwpRuntime() {
  return (hwpInit ??= import("@rhwp/core")
    .then(async (mod) => {
      const ctx = document.createElement("canvas").getContext("2d")!;
      const host = globalThis as typeof globalThis & {
        measureTextWidth?: (font: string, text: string) => number;
      };
      host.measureTextWidth = (font, text) => {
        ctx.font = font;
        return ctx.measureText(text).width;
      };
      await mod.default({ module_or_path: `${runtime}/rhwp_bg.wasm` });
      return mod;
    })
    .catch((e) => {
      hwpInit = undefined;
      throw e;
    }));
}
function safeSvg(svg: string) {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (doc.querySelector("parsererror"))
    throw new Error("한글 페이지 렌더링에 실패했습니다.");
  for (const el of doc.querySelectorAll("*")) {
    if (["script", "foreignObject", "iframe", "style"].includes(el.localName)) {
      el.remove();
      continue;
    }
    for (const a of Array.from(el.attributes)) {
      if (
        a.name.startsWith("on") ||
        (a.localName === "href" &&
          !/^(#|data:image\/(png|jpeg|webp|gif);base64,)/i.test(a.value)) ||
        (/url\(/i.test(a.value) && !/^url\(#[^)]+\)$/.test(a.value))
      )
        el.removeAttribute(a.name);
    }
  }
  return new XMLSerializer().serializeToString(doc);
}
export async function importDocument(
  file: File,
  onProgress: (p: ImportProgress) => void,
  signal: AbortSignal,
): Promise<ImportedDocument> {
  if (file.size > 50 * 1024 * 1024)
    throw new Error("PDF·한글 문서는 파일당 50MB 이하로 올려주세요.");
  if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
    const { importPdfQuestions } = await import("./pdf-registration");
    return importPdfQuestions(file, onProgress, signal);
  }
  const pages: DocumentPage[] = [];
  const warnings: string[] = [];
  let worker: OcrWorker | undefined;
  let terminatePending = false;
  const abort = () => {
    terminatePending = true;
    void worker?.terminate();
  };
  signal.addEventListener("abort", abort, { once: true });
  let pixelBudget = 0;
  async function analyze(
    canvas: HTMLCanvasElement,
    runs: TextLine[],
    index: number,
    total: number,
    sourceToAnalysis?: Matrix3,
  ) {
    checkCancelled(signal);
    let method: DocumentPage["method"] = "text";
    const pageWarnings: string[] = [];
    let lines = joinLines(runs);
    pixelBudget += canvas.width * canvas.height;
    if (pixelBudget > 100_000_000)
      throw new Error(
        "문서의 분석 이미지 한도를 초과했습니다. 페이지를 나눠 올려주세요.",
      );
    const pixels = canvas
      .getContext("2d")!
      .getImageData(0, 0, canvas.width, canvas.height);
    const { regions, neutral } = await analyzePixels(pixels, signal);
    const diagnostics: string[] = [];
    const ocrPasses: NonNullable<DocumentPage["ocrPasses"]> = [];
    if (!usableText(lines)) {
      method = "ocr";
      onProgress({
        current: index,
        total,
        message: `${index + 1}/${total}쪽 · 한글·영문 OCR 분석 중`,
      });
      try {
        if (!worker) {
          const { createWorker, OEM, PSM } = await import("tesseract.js");
          const creating = createWorker(["kor", "eng"], OEM.LSTM_ONLY, {
            workerPath: `${runtime}/ocr/worker.min.js`,
            corePath: `${runtime}/ocr`,
            langPath: `${runtime}/ocr/lang`,
            logger: (m) => {
              if (!signal.aborted && m.status === "recognizing text")
                onProgress({
                  current: index + (m.progress ?? 0) * 0.85,
                  total,
                  message: `${index + 1}/${total}쪽 · OCR ${Math.round((m.progress ?? 0) * 100)}%`,
                });
            },
          });
          creating
            .then((w) => {
              if (signal.aborted) void w.terminate();
            })
            .catch(() => {});
          worker = await abortable(creating, signal);
          if (terminatePending) {
            await worker.terminate();
            checkCancelled(signal);
          }
          await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
        }
        const analysis = document.createElement("canvas");
        analysis.width = canvas.width;
        analysis.height = canvas.height;
        analysis
          .getContext("2d")!
          .putImageData(
            new ImageData(
              new Uint8ClampedArray(neutral),
              canvas.width,
              canvas.height,
            ),
            0,
            0,
          );
        lines = await abortable(
          recognizeRegions(
            worker,
            regions,
            canvas.width,
            canvas.height,
            async (r) => {
              const crop = document.createElement("canvas");
              crop.width = Math.max(1, Math.round(r.w * canvas.width));
              crop.height = Math.max(1, Math.round(r.h * canvas.height));
              crop
                .getContext("2d")!
                .drawImage(
                  analysis,
                  r.x * canvas.width,
                  r.y * canvas.height,
                  r.w * canvas.width,
                  r.h * canvas.height,
                  0,
                  0,
                  crop.width,
                  crop.height,
                );
              return crop;
            },
            signal,
            (message) => diagnostics.push(message),
            (pass) => ocrPasses.push(pass),
          ),
          signal,
        );
        analysis.width = analysis.height = 1;
        if (!lines.length) {
          method = "unread";
          pageWarnings.push(
            "OCR로 글자를 찾지 못했습니다. 원본에서 영역을 지정해주세요.",
          );
        }
      } catch (e) {
        checkCancelled(signal);
        method = "unread";
        pageWarnings.push(
          `OCR 분석에 실패해 원본을 보존했습니다. ${e instanceof Error ? e.message : ""}`,
        );
      }
    }
    checkCancelled(signal);
    pages.push({
      id: crypto.randomUUID(),
      index,
      asset: await canvasAsset(canvas),
      sourceToAnalysis,
      diagnostics,
      ocrPasses,
      regions,
      lines,
      method,
      warnings: pageWarnings,
    });
    onProgress({
      current: index + 1,
      total,
      message: `${index + 1}/${total}쪽 · 분석 완료`,
    });
    canvas.width = 1;
    canvas.height = 1;
  }
  try {
    onProgress({
      current: 0,
      total: 1,
      message: `${file.name} · 문서 여는 중`,
    });
    const bytes = new Uint8Array(await file.arrayBuffer());
    checkCancelled(signal);
    {
      warnings.push(
        "한글 문서의 글꼴·수식·표 배치는 원본 프로그램과 다를 수 있습니다. 원본 미리보기를 확인하세요.",
      );
      const mod = await hwpRuntime();
      checkCancelled(signal);
      const doc = new mod.HwpDocument(bytes);
      try {
        const count = doc.pageCount();
        if (count < 1)
          throw new Error("한글 문서에서 페이지를 찾지 못했습니다.");
        if (count > 40)
          throw new Error(
            "한 번에 최대 40쪽까지 분석할 수 있습니다. 문서를 나눠 올려주세요.",
          );
        await document.fonts.ready;
        for (let i = 0; i < count; i++) {
          checkCancelled(signal);
          onProgress({
            current: i,
            total: count,
            message: `${i + 1}/${count}쪽 · 한글 문서 렌더링`,
          });
          await new Promise<void>((r) => requestAnimationFrame(() => r()));
          const info = JSON.parse(doc.getPageInfo(i)) as {
            width: number;
            height: number;
          };
          const svg = safeSvg(doc.renderPageSvg(i));
          const image = await imageFromBlob(
            new Blob([svg], { type: "image/svg+xml" }),
          );
          const scale = Math.min(2.2, 2200 / info.width, 3200 / info.height);
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(info.width * scale);
          canvas.height = Math.ceil(info.height * scale);
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          const layout = JSON.parse(doc.getPageTextLayout(i)) as {
            runs: {
              text: string;
              x: number;
              y: number;
              w: number;
              h: number;
            }[];
          };
          const runs = layout.runs.map((r) => ({
            ...r,
            x: r.x / info.width,
            y: r.y / info.height,
            w: r.w / info.width,
            h: r.h / info.height,
          }));
          await analyze(canvas, runs, i, count, [
            scale,
            0,
            0,
            0,
            scale,
            0,
            0,
            0,
            1,
          ]);
        }
      } finally {
        doc.free();
      }
    }
    checkCancelled(signal);
    return {
      id: crypto.randomUUID(),
      filename: file.name,
      original: file,
      sha256: Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
        ),
      )
        .map((x) => x.toString(16).padStart(2, "0"))
        .join(""),
      pages,
      pieces: segmentDocument(pages),
      warnings,
    };
  } catch (e) {
    checkCancelled(signal);
    if (e instanceof Error && e.name === "PasswordException")
      throw new Error(
        "암호가 설정된 PDF입니다. 암호를 해제한 복사본을 올려주세요.",
      );
    throw new Error(
      e instanceof Error
        ? e.message
        : "문서를 읽지 못했습니다. 암호·손상 여부를 확인하거나 PDF로 저장해 올려주세요.",
    );
  } finally {
    signal.removeEventListener("abort", abort);
    if (worker && !terminatePending) await worker.terminate();
  }
}
