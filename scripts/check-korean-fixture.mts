/** Independent fixture adapter. Full body boxes and print-pixel masks remain unmeasured. */
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { selectDocumentContent } from "../lib/documents/document-ownership";
const [fixturePath, actualPath, pdfPath] = process.argv.slice(2);
const f = JSON.parse(await fs.readFile(fixturePath, "utf8")),
  a = JSON.parse(await fs.readFile(actualPath, "utf8"));
if (
  createHash("sha256")
    .update(await fs.readFile(pdfPath))
    .digest("hex") !== f.document.sha256
)
  throw new Error("Source SHA-256 mismatch");
const checks: { check: string; passed: boolean; detail?: unknown }[] = [];
const add = (check: string, passed: boolean, detail?: unknown) =>
  checks.push({ check, passed, detail });
const section = (id: string) =>
  a.sections?.find(
    (s: any) => s.label === f.sections.find((s: any) => s.id === id)?.label,
  )?.id;
const qs = a.questions ?? [],
  ss = a.sharedSets ?? [],
  map = new Map<string, any>();
const col = (p: any) =>
  a.flowRegions.find((f: any) => f.id === p.flowRegionId)?.order === 0
    ? "left"
    : "right";
const contains = (p: any, page: number, b: any, t = 0.002) =>
  p.pageIndex === page - 1 &&
  p.bbox.x <= b.x + t &&
  p.bbox.y <= b.y + t &&
  p.bbox.x + p.bbox.width >= b.x + b.width - t &&
  p.bbox.y + p.bbox.height >= b.y + b.height - t;
add("physical pages", a.pages.length === 20);
add(
  "logical questions",
  qs.length === f.expected.allDocumentQuestions,
  qs.length,
);
add("shared set count", ss.length === f.expected.sharedSets, ss.length);
for (const s of f.sections) {
  const actual = a.sections?.filter((x: any) => x.label === s.label) ?? [];
  add(`${s.id}: section instance`, actual.length === 1);
  add(
    `${s.id}: question count`,
    qs.filter((q: any) => q.sectionId === section(s.id)).length ===
      s.expectedQuestionCount,
  );
  add(
    `${s.id}: physical pages`,
    JSON.stringify(actual[0]?.pageIndices) ===
      JSON.stringify(
        Array.from(
          { length: s.physicalPages[1] - s.physicalPages[0] + 1 },
          (_, i) => s.physicalPages[0] - 1 + i,
        ),
      ),
  );
}
for (const q of f.questions) {
  const matches = qs.filter(
    (x: any) =>
      x.sectionId === section(q.sectionId) && x.sourceNumber === q.sourceNumber,
  );
  add(`${q.id}: unique`, matches.length === 1);
  if (matches.length !== 1) continue;
  const actual = matches[0];
  map.set(q.id, actual);
  add(
    `${q.id}: page/column`,
    actual.parts[0].pageIndex === q.physicalPage - 1 &&
      col(actual.parts[0]) === q.column,
  );
  add(
    `${q.id}: printed number anchor preserved`,
    actual.parts.some((p: any) => contains(p, q.physicalPage, q.numberAnchor)),
  );
}
for (const s of f.sharedSets) {
  const matches = ss.filter(
    (x: any) =>
      x.sectionId === section(s.sectionId) &&
      JSON.stringify(x.sourceRange) === JSON.stringify(s.sourceRange),
  );
  add(`${s.id}: unique`, matches.length === 1);
  if (matches.length !== 1) continue;
  const actual = matches[0];
  map.set(s.id, actual);
  add(
    `${s.id}: ordered physical parts`,
    JSON.stringify(actual.parts.map((p: any) => [p.pageIndex + 1, col(p)])) ===
      JSON.stringify(s.sourceParts.map((p: any) => [p.physicalPage, p.column])),
  );
  add(
    `${s.id}: question ownership`,
    s.questionIds.every((id: string) =>
      actual.questionIds.includes(map.get(id)?.id),
    ) && actual.questionIds.length === s.questionIds.length,
  );
}
for (const q of f.questions) {
  const actual = map.get(q.id);
  if (actual)
    add(
      `${q.id}: required material references`,
      JSON.stringify([...actual.sharedMaterialIds].sort()) ===
        JSON.stringify(
          q.sharedSetIds.map((id: string) => map.get(id)?.id).sort(),
        ),
    );
}
for (const asset of f.selectedCompositeRasterAssets)
  for (const p of asset.parts) {
    const owner = map.get(asset.ownerId);
    add(
      `${asset.id}: ${p.physicalPage} preserved by owner`,
      !!owner?.parts.some((part: any) =>
        contains(part, p.physicalPage, p.visibleAssetBbox),
      ),
    );
    const cs = a.pages[p.physicalPage - 1].containers ?? [];
    add(
      `${asset.id}: ${p.physicalPage} tiles assembled`,
      cs.some(
        (c: any) =>
          c.tiles.length === p.rasterTileBboxes.length &&
          Math.abs(c.rect.x - p.visibleAssetBbox.x) < 0.002 &&
          Math.abs(c.rect.y - p.visibleAssetBbox.y) < 0.002 &&
          Math.abs(c.rect.h - p.visibleAssetBbox.height) < 0.002,
      ),
    );
  }
for (const [i, g] of f.protectedInlineGlyphs.entries())
  add(
    `inline glyph ${i + 1}: included`,
    [...qs, ...ss].some((owner) =>
      owner.parts.some((p: any) => contains(p, g.physicalPage, g.bbox, 0.0003)),
    ),
  );
for (const p of f.pages)
  add(
    `page ${p.physicalPage}: printed section page`,
    a.pageMetadata?.[p.physicalPage - 1]?.printedSectionPage ===
      p.printedSectionPage,
    a.pageMetadata?.[p.physicalPage - 1]?.printedSectionPage,
  );
const q10 = map.get("common:q:10"),
  q12 = map.get("common:q:12");
if (q10 && q12 && ss.length) {
  for (const selection of [[q12], [q10, q12]]) {
    const plan = selectDocumentContent(
      a,
      selection.map((q) => q.id),
    );
    add(
      `selection ${selection.map((q) => q.sourceNumber)}: shared material once`,
      plan.items.filter((i) => i.kind === "material").length === 1,
    );
    add(
      `selection ${selection.map((q) => q.sourceNumber)}: full shared parts`,
      plan.items.find((i) => i.kind === "material")?.parts.length === 2,
    );
  }
}
const local36 = map.get("eonmae:q:36");
add(
  "eonmae:q:36: multiple local material containers",
  !!local36 && local36.auxiliaryParts.length >= 2,
);
for (const page of [12, 16, 20]) {
  const instructions =
    a.instructions?.filter((i: any) => i.pageIndex === page - 1) ?? [];
  add(`page ${page}: instruction owner retained`, instructions.length === 1);
  add(
    `page ${page}: instruction excluded from question crops`,
    instructions.length === 1 &&
      !qs.some((q: any) =>
        q.parts.some(
          (p: any) =>
            p.pageIndex === page - 1 &&
            p.bbox.x < instructions[0].rect.x + instructions[0].rect.w &&
            p.bbox.x + p.bbox.width > instructions[0].rect.x &&
            p.bbox.y + p.bbox.height > instructions[0].rect.y + 0.001,
        ),
      ),
  );
}
const report = {
  source: f.document.sha256,
  actual: actualPath,
  replay: a.replay ?? null,
  summary: {
    passed: checks.filter((c) => c.passed).length,
    failed: checks.filter((c) => !c.passed).length,
  },
  checks,
  unmeasured: [
    "Full question-body bounding boxes: fixture contains number anchors only",
    "Printed/handwriting pixel loss: no ground-truth mask",
    "Poetry whitespace, embedded option completeness, footnotes: visual review required",
    "User correction time and generalization to other Korean/English documents",
  ],
  descriptiveCases: f.regressionCases.map((c: any) => ({
    id: c.id,
    title: c.title,
    status: "Partial automated evidence above; not a blanket pass",
  })),
};
await fs.writeFile(
  actualPath.replace(/\.json$/, "-checks.json"),
  JSON.stringify(report, null, 2),
);
console.log(
  JSON.stringify(
    { summary: report.summary, failed: checks.filter((c) => !c.passed) },
    null,
    2,
  ),
);
if (report.summary.failed) process.exitCode = 1;
