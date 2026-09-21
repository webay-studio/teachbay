import test from "node:test";
import assert from "node:assert/strict";
import { combineRegions } from "./hybrid-regions";
import { buildStructure, type EvidenceLine } from "./structure-experiment";
import { invert, transform, type Matrix3 } from "./registration-graph";
const line = (
  page: number,
  text: string,
  x: number,
  y: number,
  w = 0.3,
  h = 0.018,
): EvidenceLine => ({
  id: crypto.randomUUID(),
  page,
  text,
  x,
  y,
  w,
  h,
  source: "pdf",
  confidence: 100,
  role: "unassigned",
  reasons: [],
});
const page = (
  inkPoints: { x: number; y: number; w: number; h: number }[] = [],
) => ({
  asset: {
    id: "test",
    blob: new Blob(),
    mime: "image/png",
    width: 1200,
    height: 1600,
  },
  inkPoints,
  sourceKind: "native" as const,
  regions: [
    { x: 0, y: 0, w: 0.49, h: 1 },
    { x: 0.51, y: 0, w: 0.49, h: 1 },
  ],
});
test("number-only survives and joins the next flow without a giant bbox", () => {
  const ls = [
    line(0, "1.", 0.03, 0.75, 0.025),
    line(0, "다음 함수의 값을 구하시오.", 0.54, 0.12),
    line(0, "① 2 ② 3", 0.54, 0.2),
    line(0, "2.", 0.54, 0.4, 0.025),
    line(0, "다음 조건의 값을 구하시오.", 0.54, 0.44),
  ];
  const r = combineRegions(buildStructure(ls, 1), [page()]);
  assert.equal(r.questions?.length, 2);
  assert.equal(r.questions![0].parts.length, 2);
  assert.equal(r.questions![0].parts[0].role, "number-only");
  assert.equal(r.questions![0].parts[1].role, "continuation");
  assert.ok(r.questions![0].parts.every((p) => p.bbox.width < 0.5));
});
test("a score does not truncate a following diagram", () => {
  const ls = [
    line(0, "1. 다음 도형을 보시오 [3점]", 0.03, 0.2),
    line(0, "2. 다음 문제의 값을 구하시오.", 0.03, 0.65),
  ];
  const r = combineRegions(buildStructure(ls, 1), [
    page([{ x: 0.1, y: 0.35, w: 0.2, h: 0.2 }]),
  ]);
  const q = r.questions?.find((q) => q.sourceNumber === 1);
  assert.ok(q);
  assert.ok(q.parts[0].bbox.y + q.parts[0].bbox.height >= 0.55);
});
test("native bare numeral preceding prose never acquires a fabricated period", () => {
  const s = buildStructure(
    [
      line(0, "5", 0.03, 0.2, 0.012),
      line(0, "개의 원소를 가지고 있는 집합", 0.046, 0.2),
    ],
    1,
  );
  assert.ok(!s.lines.some((l) => l.text.startsWith("5.")));
});
test("material at a flow boundary is not absorbed as continuation", () => {
  const ls = [
    line(0, "1.", 0.03, 0.75, 0.025),
    line(0, "[2~3] 다음 글을 읽고", 0.54, 0.12),
    line(0, "2. 옳은 것을 고르시오.", 0.54, 0.4),
  ];
  const r = combineRegions(buildStructure(ls, 1), [page()]);
  assert.equal(r.questions?.find((q) => q.sourceNumber === 1)?.parts.length, 1);
  assert.ok(r.groups.some((g) => g.kind === "material"));
});
test("90/270 degree crop transforms round trip four corners and an anchor", () => {
  for (const m of [
    [0, 2, -40, 2, 0, -80, 0, 0, 1],
    [0, -2, 1700, -2, 0, 1200, 0, 0, 1],
  ] as Matrix3[]) {
    for (const p of [
      [20, 40],
      [600, 40],
      [600, 850],
      [20, 850],
      [55, 120],
    ] as [number, number][]) {
      const round = transform(invert(m), transform(m, p));
      assert.ok(
        Math.abs(round[0] - p[0]) < 1e-8 && Math.abs(round[1] - p[1]) < 1e-8,
      );
    }
  }
});

test("uncertain scan prefix is not silently attached to previous question", () => {
  const ls = [
    line(0, "1. 다음 값을 구하시오.", 0.03, 0.2),
    line(0, "조건 x=2", 0.54, 0.12),
    line(0, "2. 다음 값을 구하시오.", 0.54, 0.4),
  ];
  ls.forEach((l) => {
    l.source = "ocr";
    l.confidence = 85;
  });
  const p = { ...page(), sourceKind: "scan" as const };
  const r = combineRegions(buildStructure(ls, 1), [p]);
  assert.equal(r.questions?.find((q) => q.sourceNumber === 1)?.parts.length, 1);
  assert.ok(r.hybrid[0].unassignedGroups.length > 0);
  assert.equal(r.questions?.[0].sourceLabel, "1.");
});

test("same-location OCR conflict uses an observed alternative, never a generated number", () => {
  const ls = [
    line(0, "13. 다음 값을 구하시오.", 0.03, 0.15),
    line(0, "4. 다음 값을 구하시오.", 0.03, 0.5),
    line(0, "14. 다음 값을 구하시오.", 0.031, 0.502),
    line(0, "15. 다음 값을 구하시오.", 0.54, 0.15),
  ];
  ls.forEach((l) => {
    l.source = "ocr";
    l.confidence = 85;
  });
  const r = combineRegions(buildStructure(ls, 1), [
    { ...page(), sourceKind: "scan" as const },
  ]);
  assert.ok(r.questions?.some((q) => q.sourceNumber === 14));
  assert.ok(!r.questions?.some((q) => q.sourceNumber === 4));
});
