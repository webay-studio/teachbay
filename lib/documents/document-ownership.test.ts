import test from "node:test";
import assert from "node:assert/strict";
import {
  assignDocumentOwnership,
  readSharedRange,
  selectDocumentContent,
  updateDocumentPart,
} from "./document-ownership";
import { assessNativeFonts } from "./native-observations";
import { pdfRasterContainers } from "./pdf-geometry";
import type { EvidenceLine, StructureResult } from "./structure-experiment";
import type { ExperimentPage } from "./extract-experiment";
import type { Observation } from "./question-regions";
const line = (
  page: number,
  x: number,
  y: number,
  text: string,
  w = 0.32,
): EvidenceLine => ({
  id: crypto.randomUUID(),
  page,
  x,
  y,
  w,
  h: 0.015,
  text,
  source: "ocr",
  role: "unassigned",
  confidence: 90,
  reasons: [],
});
const make = (lines: EvidenceLine[], n: number) => {
  const pages = Array.from({ length: n }, (_, index) => ({
    index,
    asset: {
      id: `p${index}`,
      blob: new Blob(),
      mime: "image/png",
      width: 1000,
      height: 1400,
    },
    inkPoints: [],
    observations: [],
    containers: [],
    visualRegions: [],
  })) as unknown as ExperimentPage[];
  const base: StructureResult = {
    lines,
    groups: [],
    relations: [],
    questions: [],
    flowRegions: pages.flatMap((p, i) =>
      [0, 1].map((order) => ({
        id: `f${i}-${order}`,
        pageIndex: i,
        order,
        rect: { x: order * 0.5 + 0.08, y: 0.02, w: 0.4, h: 0.96 },
        kind: "column" as const,
      })),
    ),
  };
  return { base, pages };
};
test("range head closes prior question and carries shared ownership over three reading regions", () => {
  const { base, pages } = make(
    [
      line(0, 0.3, 0.08, "국어 영역"),
      line(0, 0.1, 0.2, "[1~2] 다음 글을 읽고 물음에 답하시오."),
      line(0, 0.11, 0.3, "첫 번째 지문"),
      line(0, 0.6, 0.16, "두 번째 지문"),
      line(1, 0.3, 0.08, "국어 영역"),
      line(1, 0.1, 0.16, "마지막 지문"),
      line(1, 0.1, 0.3, "1. 내용으로 적절한 것은?"),
      line(1, 0.1, 0.5, "2. 내용으로 적절한 것은?"),
      line(1, 0.6, 0.15, "[3~4] 다음 글을 읽고 물음에 답하시오."),
      line(1, 0.6, 0.25, "새 지문"),
      line(1, 0.6, 0.45, "3. 내용으로 적절한 것은?"),
      line(1, 0.6, 0.7, "4. 내용으로 적절한 것은?"),
    ],
    2,
  );
  const r = assignDocumentOwnership(base, pages);
  assert.equal(r.questions?.length, 4);
  assert.equal(r.sharedSets?.length, 2);
  assert.deepEqual(
    r.sharedSets?.[0].parts.map((p) => p.flowRegionId),
    ["f0-0", "f0-1", "f1-0"],
  );
  assert.equal(r.questions?.[1].parts.length, 1);
  const selected = selectDocumentContent(
    r,
    r.questions!.slice(0, 2).map((q) => q.id),
  );
  assert.equal(selected.items.filter((i) => i.kind === "material").length, 1);
  assert.equal(selected.items[0].parts.length, 3);
  assert.equal(
    selectDocumentContent(r, [r.questions![1].id]).items[0].parts.length,
    3,
  );
});
test("section instances retain repeated source numbers; OCR-spelled subject is metadata", () => {
  const { base, pages } = make(
    [
      line(0, 0.3, 0.08, "국어 영역(화법과 직문)"),
      line(0, 0.1, 0.2, "[35~36] 다음 글을 읽고 물음에 답하시오."),
      line(0, 0.1, 0.4, "35. 적절한 것은?"),
      line(0, 0.6, 0.2, "36. 적절한 것은?"),
      line(1, 0.3, 0.08, "국어 영역(언어와 매체)"),
      line(1, 0.1, 0.2, "[35~36] 다음 글을 읽고 물음에 답하시오."),
      line(1, 0.1, 0.4, "35. 적절한 것은?"),
      line(1, 0.6, 0.2, "36. 적절한 것은?"),
    ],
    2,
  );
  const r = assignDocumentOwnership(base, pages);
  assert.deepEqual(
    r.sections?.map((s) => s.label),
    ["화법과 작문", "언어와 매체"],
  );
  assert.deepEqual(
    r.questions?.map((q) => q.sourceNumber),
    [35, 36, 35, 36],
  );
  assert.notEqual(r.questions![0].sectionId, r.questions![2].sectionId);
});
test("internal screenshot list and conflicting passage numbers cannot steal material ownership", () => {
  const { base, pages } = make(
    [
      line(0, 0.3, 0.08, "국어 영역"),
      line(0, 0.1, 0.2, "[40~43] 다음 글을 읽고 물음에 답하시오."),
      line(0, 0.1, 0.3, "1. 알림 화면의 목록"),
      line(0, 0.1, 0.4, "40. 화면 내부의 번호"),
      line(0, 0.6, 0.2, "40. 실제 문항 내용은?"),
      line(0, 0.6, 0.5, "41. 실제 문항 내용은?"),
    ],
    1,
  );
  pages[0].containers = [
    {
      id: "screen",
      rect: { x: 0.09, y: 0.29, w: 0.35, h: 0.25 },
      tiles: [],
      kind: "raster",
    },
  ];
  const r = assignDocumentOwnership(base, pages);
  assert.deepEqual(
    r.questions?.map((q) => q.sourceNumber),
    [40, 41],
  );
  assert.equal(r.sharedSets?.[0].questionIds.length, 2);
});
test("recognized page margins do not re-enter through connected components or PDF geometry", () => {
  const { base, pages } = make(
    [
      line(0, 0.3, 0.08, "국어 영역"),
      line(0, 0.1, 0.2, "[1~2] 다음 글을 읽고 물음에 답하시오."),
      line(0, 0.11, 0.3, "공통 본문"),
      line(0, 0.6, 0.18, "이어지는 지문"),
      line(0, 0.6, 0.4, "1. 적절한 것은?"),
      line(0, 0.6, 0.6, "2. 적절한 것은?"),
      line(0, 0.45, 0.93, "1 20", 0.08),
    ],
    1,
  );
  pages[0].inkPoints = [
    { x: 0.61, y: 0.08, w: 0.02, h: 0.02 },
    { x: 0.46, y: 0.93, w: 0.02, h: 0.02 },
  ];
  pages[0].visualRegions = [{ x: 0.62, y: 0.08, w: 0.2, h: 0.02 }];
  const r = assignDocumentOwnership(base, pages);
  assert(r.sharedSets![0].parts[1].bbox.y > 0.12);
  assert(
    r.questions!.at(-1)!.parts[0].bbox.y +
      r.questions!.at(-1)!.parts[0].bbox.height <
      0.9,
  );
});
test("font corruption withholds text without deleting geometry; CJK or old Hangul alone is valid", () => {
  const obs = (text: string, fontName: string): Observation => ({
    id: crypto.randomUUID(),
    text,
    fontName,
    source: "pdf",
    pageIndex: 0,
    passId: "native",
    flowRegionId: "f",
    transform: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    confidence: 100,
    rect: { x: 0.1, y: 0.2, w: 0.3, h: 0.02 },
    state: "supported",
    issues: [],
    inkSupport: 1,
    removedInkRatio: 0,
    geometryStatus: "usable",
    textStatus: "usable",
  });
  const a = [
    obs("\u0001\u0002broken", "bad"),
    obs("wrong glyphs", "bad"),
    obs("저작권 안내", "footer"),
  ];
  assessNativeFonts(a);
  assert.equal(a[1].textStatus, "encoding-suspect");
  assert.equal(a[1].geometryStatus, "usable");
  assert.equal(a[2].state, "supported");
  const b = [obs("天地玄黃 ᄒᆞᆫ", "good")];
  assessNativeFonts(b);
  assert.equal(b[0].state, "supported");
});
test("PDF image tiles join by seam and alignment while small inline glyph remains", () => {
  const codes = { save: 1, restore: 2, transform: 3, paintImageXObject: 4 };
  const ops = {
    fnArray: [1, 3, 4, 2, 1, 3, 4, 2, 1, 3, 4, 2],
    argsArray: [
      [],
      [30, 0, 0, 20, 10, 10],
      ["a"],
      [],
      [],
      [30, 0, 0, 10, 10, 30],
      ["b"],
      [],
      [],
      [1, 0, 0, 1, 50, 50],
      ["glyph"],
      [],
    ],
  };
  const c = pdfRasterContainers(ops, codes, [1, 0, 0, 1, 0, 0], 100, 100);
  assert.equal(c.length, 2);
  assert(Math.abs(c.find((x) => x.tiles.length === 2)!.rect.h - 0.3) < 1e-9);
  assert(c.some((x) => Math.abs(x.rect.w - 0.01) < 1e-9));
});
test("a bare numeric interval is not automatically a common passage", () => {
  assert.equal(readSharedRange("09-18 운영 시간"), undefined);
  assert.deepEqual(readSharedRange("[10~13] 다음 글"), [10, 13]);
});

test("manual shared boundary updates both preview and selection export without changing original order", () => {
  const { base, pages } = make(
    [
      line(0, 0.3, 0.08, "국어 영역"),
      line(0, 0.1, 0.2, "[1~2] 다음 글을 읽으시오."),
      line(0, 0.1, 0.4, "1. 적절한 것은?"),
      line(0, 0.6, 0.2, "2. 적절한 것은?"),
    ],
    1,
  );
  const r = assignDocumentOwnership(base, pages),
    part = r.sharedSets![0].parts[0],
    rect = { x: 0.1, y: 0.19, w: 0.35, h: 0.18 };
  const changed = updateDocumentPart(r, part.id, rect);
  assert.deepEqual(changed.groups.find((g) => g.id === part.id)!.rect, rect);
  const plan = selectDocumentContent(changed, [r.questions![0].id]);
  assert.equal(plan.items[0].parts[0].bbox.height, 0.18);
  assert.notEqual(r.sharedSets![0].parts[0].bbox.height, 0.18);
  assert.throws(() => selectDocumentContent(r, ["missing"]));
  assert.throws(() =>
    updateDocumentPart(r, part.id, { x: 0, y: 0, w: 2, h: 1 }),
  );
});

test("an instruction heading uses its enclosing frame boundary, not the text baseline", () => {
  const { base, pages } = make(
    [
      line(0, 0.3, 0.08, "국어 영역"),
      line(0, 0.1, 0.2, "[1~2] 다음 글을 읽으시오."),
      line(0, 0.1, 0.4, "1. 적절한 것은?"),
      line(0, 0.6, 0.2, "2. 적절한 것은?"),
      line(0, 0.62, 0.805, "확인 사항", 0.09),
    ],
    1,
  );
  pages[0].inkPoints = [{ x: 0.6, y: 0.79, w: 0.35, h: 0.08 }];
  const r = assignDocumentOwnership(base, pages);
  const p = r.questions![1].parts[0];
  assert(p.bbox.y + p.bbox.height < 0.79);
  assert.equal(r.instructions?.length, 1);
  assert.equal(r.instructions![0].rect.y, 0.79);
});

test("a numeric interval without reading instructions does not replace the math pipeline", () => {
  const { base, pages } = make(
    [line(0, 0.1, 0.2, "[6-51]"), line(0, 0.1, 0.3, "(0 —8—0")],
    1,
  );
  assert.equal(assignDocumentOwnership(base, pages), base);
});

test("a footer fraction frame is excluded even if OCR sees only its lower number", () => {
  const { base, pages } = make(
    [
      line(0, 0.3, 0.08, "국어 영역"),
      line(0, 0.1, 0.2, "[1~2] 다음 글을 읽으시오."),
      line(0, 0.1, 0.4, "1. 적절한 것은?"),
      line(0, 0.6, 0.2, "2. 적절한 것은?"),
      line(0, 0.51, 0.925, "20", 0.02),
    ],
    1,
  );
  pages[0].visualRegions = [{ x: 0.46, y: 0.905, w: 0.08, h: 0.045 }];
  pages[0].inkPoints = [{ x: 0.47, y: 0.91, w: 0.01, h: 0.012 }];
  const r = assignDocumentOwnership(base, pages);
  assert(
    r.questions![0].parts[0].bbox.y + r.questions![0].parts[0].bbox.height <
      0.9,
  );
});
