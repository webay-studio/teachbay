import { recognizeRegions } from "../lib/documents/ocr";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createCanvas, loadImage, ImageData } from "@napi-rs/canvas";
import { createWorker, PSM } from "tesseract.js";
import { physicalRegions, neutralPixels } from "../lib/documents/physical";
import { segmentDocument } from "../lib/documents/segment";
import type { DocumentPage } from "../lib/documents/types";
async function main() {
  const source = process.argv[2];
  if (!source) throw new Error("Source PDF path required");
  const baseline = JSON.parse(
    await fs.readFile("output/registration-baseline/graph-ocr.json", "utf8"),
  );
  if (
    createHash("sha256")
      .update(await fs.readFile(source))
      .digest("hex") !== baseline.document.sha256
  )
    throw new Error("Cached render belongs to another source");
  const dir = "output/registration-v2";
  await fs.mkdir(dir, { recursive: true });
  const worker = await createWorker(["kor", "eng"], 1, {
    langPath: path.resolve("public/document-runtime/ocr/lang"),
    cacheMethod: "none",
  });
  await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
  const pages: DocumentPage[] = [];
  const start = performance.now();
  try {
    for (let i = 0; i < baseline.document.pageCount; i++) {
      const img = await loadImage(
          `output/registration-baseline/page-${i + 1}.png`,
        ),
        canvas = createCanvas(img.width, img.height),
        ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height),
        regions = physicalRegions(pixels.data, canvas.width, canvas.height);
      ctx.putImageData(
        new ImageData(neutralPixels(pixels.data), canvas.width, canvas.height),
        0,
        0,
      );
      const lines = await recognizeRegions(
        worker,
        regions,
        canvas.width,
        canvas.height,
        async (r) => {
          const crop = createCanvas(
            Math.round(r.w * canvas.width),
            Math.round(r.h * canvas.height),
          );
          crop
            .getContext("2d")
            .drawImage(
              canvas,
              r.x * canvas.width,
              r.y * canvas.height,
              r.w * canvas.width,
              r.h * canvas.height,
              0,
              0,
              crop.width,
              crop.height,
            );
          return crop.toBuffer("image/png");
        },
      );
      pages.push({
        id: `page-${i}`,
        index: i,
        regions,
        lines,
        method: lines.length ? "ocr" : "unread",
        warnings: [],
        asset: {
          id: `page-${i}`,
          blob: new Blob(),
          mime: "image/png",
          width: canvas.width,
          height: canvas.height,
        },
      });
      console.log(
        `page ${i + 1}: ${regions.length} regions, ${lines.length} lines`,
      );
    }
  } finally {
    await worker.terminate();
  }
  const pieces = segmentDocument(pages);
  await fs.writeFile(
    `${dir}/analysis.json`,
    JSON.stringify(
      {
        sourceSha256: baseline.document.sha256,
        renderCache: true,
        analysisMs: performance.now() - start,
        pages,
        pieces,
      },
      null,
      2,
    ),
  );
  for (const p of pages) {
    const img = await loadImage(
        `output/registration-baseline/page-${p.index + 1}.png`,
      ),
      c = createCanvas(img.width, img.height),
      ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    for (const piece of pieces) {
      for (const f of piece.fragments.filter((f) => f.pageId === p.id)) {
        ctx.strokeStyle = piece.kind === "question" ? "#d32938" : "#185ac4";
        ctx.lineWidth = 3;
        ctx.strokeRect(
          f.rect.x * c.width,
          f.rect.y * c.height,
          f.rect.w * c.width,
          f.rect.h * c.height,
        );
        ctx.fillStyle = ctx.strokeStyle;
        ctx.font = "22px sans-serif";
        ctx.fillText(
          piece.originalLabel ?? "review",
          f.rect.x * c.width + 3,
          f.rect.y * c.height + 22,
        );
      }
    }
    await fs.writeFile(
      `${dir}/page-${p.index + 1}.png`,
      c.toBuffer("image/png"),
    );
  }
  await fs.writeFile(
    `${dir}/review.html`,
    `<!doctype html><meta charset="utf-8"><h1>v2 분리 후보 — 확인 전 저장되지 않습니다</h1>${pages.map((p) => `<h2>${p.index + 1}쪽</h2><img style="max-width:100%" src="page-${p.index + 1}.png">`).join("")}`,
  );
  console.log(
    pieces.map((p) => ({
      name: p.name,
      kind: p.kind,
      fragments: p.fragments.length,
    })),
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
