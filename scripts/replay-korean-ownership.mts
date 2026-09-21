/** Replay captured OCR with current PDF structure extraction; does not rerun OCR. */
import fs from "node:fs/promises";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  pdfRasterContainers,
  pdfGeometry,
} from "../lib/pdf-region-engine/pdf-geometry";
import { assessNativeFonts } from "../lib/pdf-region-engine/native-observations";
import { assignDocumentOwnership } from "../lib/pdf-region-engine/core";
import { combineRegions } from "../lib/pdf-region-engine/core";
import { buildStructure } from "../lib/pdf-region-engine/core";
const [input, pdfPath, output] = process.argv.slice(2);
const d = JSON.parse(await fs.readFile(input, "utf8"));
const pdf = await getDocument({
  data: new Uint8Array(await fs.readFile(pdfPath)),
}).promise;
for (const p of d.pages) {
  const page = await pdf.getPage(p.index + 1),
    v = page.getViewport({
      scale: p.width / page.getViewport({ scale: 1 }).width,
    }),
    ops = await page.getOperatorList();
  p.containers = pdfRasterContainers(ops, OPS, v.transform, p.width, p.height);
  p.horizontalRules = [];
  p.visualRegions = [
    ...pdfGeometry(ops, OPS, v.transform, p.width, p.height, p.horizontalRules),
    ...p.containers
      .filter((c: any) => c.rect.w < 0.85 && c.rect.h < 0.85)
      .map((c: any) => c.rect),
  ];
  const os = p.observations.filter((o: any) => o.source === "pdf");
  for (const o of os) {
    o.geometryStatus = o.inkSupport >= 0.3 ? "usable" : "uncertain";
    o.textStatus = /[�\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(o.text)
      ? "encoding-suspect"
      : "usable";
  }
  assessNativeFonts(os);
}
const lines = d.lines.filter(
  (l: any) =>
    l.source !== "pdf" ||
    d.pages[l.page].observations.some(
      (o: any) => l.observationIds?.includes(o.id) && o.state === "supported",
    ),
);
const pages = d.pages.map((p: any) => ({
  ...p,
  asset: { id: "replay", blob: new Blob(), width: p.width, height: p.height },
  regions: d.flowRegions
    .filter((f: any) => f.pageIndex === p.index)
    .map((f: any) => f.rect),
}));
const r = assignDocumentOwnership(
  combineRegions(buildStructure(lines, pages.length, []), pages),
  pages,
);
await fs.writeFile(
  output,
  JSON.stringify(
    {
      ...d,
      ...r,
      pages: d.pages,
      replay: { input, ocrReexecuted: false, geometryReextracted: true },
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    questions: r.questions?.length,
    sections: r.sections?.map((s) => [
      s.label,
      s.pageIndices,
      r.questions
        ?.filter((q) => q.sectionId === s.id)
        .map((q) => q.sourceNumber),
    ]),
    sets: r.sharedSets?.map((s) => [
      s.sourceRange,
      s.parts.map((p) => [p.pageIndex + 1, p.flowRegionId]),
      s.questionIds.length,
    ]),
  }),
);
await pdf.cleanup();
