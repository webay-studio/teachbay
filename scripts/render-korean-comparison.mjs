import fs from "node:fs/promises";
import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
const [beforeFile, afterFile, renderDir, outDir] = process.argv.slice(2);
await fs.mkdir(outDir, { recursive: true });
const before = JSON.parse(await fs.readFile(beforeFile, "utf8")),
  after = JSON.parse(await fs.readFile(afterFile, "utf8"));
for (let i = 0; i < after.pages.length; i++) {
  const img = await loadImage(path.join(renderDir, `korean-${i + 1}.png`)),
    scale = 900 / img.width,
    w = 900,
    h = Math.ceil(img.height * scale);
  const c = createCanvas(w * 2, h + 50),
    ctx = c.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, c.width, c.height);
  for (const [k, d] of [before, after].entries()) {
    const ox = k * w;
    ctx.drawImage(img, ox, 50, w, h);
    ctx.font = "20px sans-serif";
    ctx.fillStyle = "#111";
    ctx.fillText(`${k ? "AFTER" : "BEFORE"} / page ${i + 1}`, ox + 16, 30);
    for (const owner of [...(d.questions ?? []), ...(d.sharedSets ?? [])])
      for (const part of owner.parts.filter((p) => p.pageIndex === i)) {
        const shared = "sourceRange" in owner,
          b = part.bbox,
          color = shared ? "#aa22dd" : "#009a72";
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(ox + b.x * w, 50 + b.y * h, b.width * w, b.height * h);
        ctx.fillStyle = color;
        ctx.font = "16px sans-serif";
        ctx.fillText(
          shared
            ? `S ${owner.sourceRange.join("-")}`
            : `Q ${owner.sourceNumber}`,
          ox + b.x * w,
          48 + b.y * h,
        );
      }
  }
  await fs.writeFile(
    path.join(outDir, `page-${i + 1}.png`),
    c.toBuffer("image/png"),
  );
}
await fs.writeFile(
  path.join(outDir, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Before / after original PDF regions</title><style>body{font:16px sans-serif;max-width:1600px;margin:auto}img{width:100%}figure{margin:30px 0}</style><h1>Before / after</h1><p>Green: question. Purple: shared material. Original source pixels; no handwriting filter.</p>${after.pages.map((_, i) => `<figure><figcaption>Physical page ${i + 1}</figcaption><img loading="lazy" src="page-${i + 1}.png"></figure>`).join("")}`,
);
