/** Read-only source analysis. Usage: node --import tsx scripts/benchmark-registration.ts input.pdf [--ocr] */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { createCanvas } from "@napi-rs/canvas";

import { createWorker, PSM } from "tesseract.js";
import { joinLines, segmentDocument } from "../lib/documents/segment";
import type { DocumentPage, TextLine } from "../lib/documents/types";
import {
  invert,
  transform,
  validateGraph,
  type Matrix3,
  type RegistrationGraph,
} from "../lib/documents/registration-graph";
async function main() {
  const { getDocument, OPS } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const input = process.argv[2];
  if (!input) throw new Error("PDF path required");
  const useOCR = process.argv.includes("--ocr");
  const dir = path.resolve("output/registration-baseline");
  await fs.mkdir(dir, { recursive: true });
  const bytes = await fs.readFile(input),
    sha = createHash("sha256").update(bytes).digest("hex");
  const started = performance.now(),
    cpu = process.cpuUsage();
  const loadingTask = getDocument({ data: new Uint8Array(bytes) });
  const pdf = await loadingTask.promise;
  if (pdf.numPages > 40) throw new Error("Prototype page budget exceeded (40)");
  const graph: RegistrationGraph = {
    version: "0.1",
    document: {
      id: randomUUID(),
      sha256: sha,
      sourceRef: path.resolve(input),
      pageCount: pdf.numPages,
      analysisVersion: "baseline-0.1",
    },
    fragments: [],
    nodes: [],
    relations: [],
  };
  const pages: DocumentPage[] = [],
    frames = new Map<
      string,
      { matrix: Matrix3; width: number; height: number }
    >(),
    metrics: Record<string, unknown>[] = [];
  const worker = useOCR
    ? await createWorker(["kor", "eng"], 1, {
        langPath: path.resolve("public/document-runtime/ocr/lang"),
        cacheMethod: "none",
      })
    : null;
  if (worker) await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const t = performance.now(),
        p = await pdf.getPage(i),
        v = p.getViewport({ scale: 1.8 });
      const [a, b, c, d, e, f] = v.transform,
        m: Matrix3 = [a, c, e, b, d, f, 0, 0, 1];
      const canvas = createCanvas(Math.ceil(v.width), Math.ceil(v.height));
      await p.render({
        canvas: canvas as never,
        canvasContext: canvas.getContext("2d") as never,
        viewport: v,
      }).promise;
      const png = canvas.toBuffer("image/png");
      await fs.writeFile(path.join(dir, `page-${i}.png`), png);
      const content = await p.getTextContent(),
        annotations = await p.getAnnotations(),
        ops = await p.getOperatorList();
      const raw: TextLine[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const pt = transform(m, [item.transform[4], item.transform[5]]);
        const h = Math.hypot(item.transform[2], item.transform[3]) * 1.8;
        raw.push({
          text: item.str,
          x: pt[0] / v.width,
          y: (pt[1] - h) / v.height,
          w: (item.width * 1.8) / v.width,
          h: h / v.height,
        });
      }
      let lines = joinLines(raw),
        method: DocumentPage["method"] = lines.length ? "text" : "unread",
        ocrMs = 0;
      if (worker && lines.map((l) => l.text).join("").length < 25) {
        const o = performance.now();
        const result = await worker.recognize(
          png,
          {},
          { blocks: true, text: true },
        );
        ocrMs = performance.now() - o;
        lines = (result.data.blocks ?? []).flatMap((b) =>
          b.paragraphs.flatMap((p) =>
            p.lines.map((l) => ({
              text: l.text,
              confidence: l.confidence,
              x: l.bbox.x0 / v.width,
              y: l.bbox.y0 / v.height,
              w: (l.bbox.x1 - l.bbox.x0) / v.width,
              h: (l.bbox.y1 - l.bbox.y0) / v.height,
            })),
          ),
        );
        method = lines.length ? "ocr" : "unread";
      }
      const id = randomUUID();
      frames.set(id, { matrix: m, width: v.width, height: v.height });
      pages.push({
        id,
        index: i - 1,
        asset: {
          id: randomUUID(),
          blob: new Blob(),
          mime: "image/png",
          width: v.width,
          height: v.height,
        },
        lines,
        method,
        warnings: [],
      });
      metrics.push({
        page: i,
        rotation: p.rotate,
        sourceView: p.view,
        analysisSize: [v.width, v.height],
        textItems: content.items.length,
        annotations: annotations.length,
        imageOperators: ops.fnArray.filter((x) =>
          [
            OPS.paintImageXObject,
            OPS.paintInlineImageXObject,
            OPS.paintImageMaskXObject,
          ].includes(x),
        ).length,
        method,
        ocrMs,
        elapsedMs: performance.now() - t,
        renderBytes: png.length,
      });
      await fs.writeFile(
        path.join(dir, `lines-${i}-${useOCR ? "ocr" : "native"}.json`),
        JSON.stringify(lines, null, 2),
      );
      console.log(
        `page ${i}/${pdf.numPages}: ${method}, ${lines.length} lines`,
      );
      p.cleanup();
    }
  } finally {
    if (worker) await worker.terminate();
    await loadingTask.destroy();
  }
  const pieces = segmentDocument(pages);
  for (const piece of pieces) {
    const node = {
      id: piece.id,
      kind:
        piece.kind === "passage"
          ? "material"
          : piece.kind === "question"
            ? "question"
            : "unassigned",
      originalLabel: piece.number?.toString(),
      sectionId: null,
      fragmentIds: [] as string[],
      requiredMaterialIds: [],
      dependencyIds: [],
      state: "review",
      reasons: [
        ...piece.warnings,
        "Boundary and ownership are unverified baseline proposals",
      ],
      quality: {
        boundary: "unknown",
        order: "unknown",
        material: "unknown",
        completeness: "unknown",
      },
    } as RegistrationGraph["nodes"][number];
    for (const [index, fragment] of piece.fragments.entries()) {
      const page = pages.find((p) => p.id === fragment.pageId)!,
        frame = frames.get(page.id)!,
        r = fragment.rect;
      const x = r.x * frame.width,
        y = r.y * frame.height,
        w = r.w * frame.width,
        h = r.h * frame.height,
        inv = invert(frame.matrix),
        id = randomUUID();
      graph.fragments.push({
        id,
        documentId: graph.document.id,
        pageIndex: page.index,
        sourceRef: graph.document.sourceRef,
        polygon: [
          [x, y],
          [x + w, y],
          [x + w, y + h],
          [x, y + h],
        ].map((p) => transform(inv, p as [number, number])),
        analysisRect: [x, y, w, h],
        sourceToAnalysis: frame.matrix,
        analysisToSource: inv,
        readingOrder: index,
        indivisible: true,
        safeBreaks: [],
      });
      node.fragmentIds.push(id);
      graph.relations.push({
        id: randomUUID(),
        from: id,
        to: node.id,
        kind: "belongs_to",
        state: "candidate",
        evidence: { fragmentIds: [id], method: useOCR ? "ocr" : "rule" },
      });
      if (index)
        graph.relations.push({
          id: randomUUID(),
          from: node.fragmentIds[index - 1],
          to: id,
          kind: "continues",
          state: "candidate",
          evidence: {
            fragmentIds: [node.fragmentIds[index - 1], id],
            method: "rule",
            text: "Leading content after column/page transition; not semantically verified",
          },
        });
    }
    graph.nodes.push(node);
  }
  for (const piece of pieces.filter((p) => p.kind === "question" && p.group))
    for (const material of pieces.filter(
      (m) => m.kind === "passage" && m.group === piece.group,
    ))
      graph.relations.push({
        id: randomUUID(),
        from: piece.id,
        to: material.id,
        kind: "requires_material",
        state: "candidate",
        evidence: {
          fragmentIds: graph.nodes.find((n) => n.id === material.id)!
            .fragmentIds,
          method: "rule",
          text: "Number range only; confirmation required",
        },
      });
  const suffix = useOCR ? "ocr" : "no-ai";
  const elapsedMs = performance.now() - started,
    cpuUsed = process.cpuUsage(cpu);
  const report = {
    mode: suffix,
    sourceBytes: bytes.length,
    pages: metrics,
    candidates: graph.nodes.reduce(
      (a, n) => ((a[n.kind] = (a[n.kind] ?? 0) + 1), a),
      {} as Record<string, number>,
    ),
    externalApiCalls: 0,
    localOcrCalls: useOCR
      ? metrics.filter((m) => m.method === "ocr").length
      : 0,
    elapsedMs,
    cpuMs: (cpuUsed.user + cpuUsed.system) / 1000,
    validationErrors: validateGraph(graph),
    quality:
      "No ground truth usability score. Every candidate requires review.",
    currencyCost: null,
  };
  await fs.writeFile(
    path.join(dir, `graph-${suffix}.json`),
    JSON.stringify(graph, null, 2),
  );
  await fs.writeFile(
    path.join(dir, `report-${suffix}.json`),
    JSON.stringify(report, null, 2),
  );
  const { loadImage } = await import("@napi-rs/canvas");
  for (let i = 0; i < pages.length; i++) {
    const img = await loadImage(path.join(dir, `page-${i + 1}.png`)),
      c = createCanvas(img.width, img.height),
      ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    for (const fr of graph.fragments.filter((f) => f.pageIndex === i)) {
      const n = graph.nodes.find((n) => n.fragmentIds.includes(fr.id))!;
      ctx.strokeStyle = n.kind === "question" ? "#d62931" : "#175ad3";
      ctx.lineWidth = 3;
      ctx.strokeRect(...fr.analysisRect);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.font = "bold 24px sans-serif";
      ctx.fillText(
        `${n.kind} ${n.originalLabel ?? ""} [candidate]`,
        fr.analysisRect[0] + 4,
        fr.analysisRect[1] + 24,
      );
    }
    await fs.writeFile(
      path.join(dir, `overlay-${suffix}-${i + 1}.png`),
      c.toBuffer("image/png"),
    );
  }
  const html = `<!doctype html><meta charset="utf-8"><title>등록 엔진 기준선</title><style>body{font:16px system-ui;margin:32px;background:#eee}img{max-width:100%;display:block}section{max-width:1000px;margin:24px auto}pre{white-space:pre-wrap;background:white;padding:20px}</style><h1>${suffix}: 문항 영역 후보 검토</h1><p>모든 테두리는 미확정 후보입니다. 원본 페이지는 보존되며 자동 저장하지 않습니다. 외부 AI 호출 없음.</p><pre>${JSON.stringify(report, null, 2).replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</pre>${pages.map((_, i) => `<section><h2>${i + 1}쪽</h2><a href="page-${i + 1}.png">원본 렌더링</a><img src="overlay-${suffix}-${i + 1}.png"></section>`).join("")}`;
  await fs.writeFile(path.join(dir, `review-${suffix}.html`), html);
  console.log(JSON.stringify(report, null, 2));
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
