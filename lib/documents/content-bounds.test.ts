import test from "node:test";
import assert from "node:assert/strict";
import {
  assessContent,
  applyContentProposal,
  keepCandidate,
  withContentBounds,
} from "./content-bounds";
import type { DocumentPage, Fragment, TextLine } from "./types";
const rect = { x: 0.05, y: 0.1, w: 0.43, h: 0.8 };
const f: Fragment = { pageId: "p", rect };
const line = (text: string, y: number, h = 0.025): TextLine => ({
  text,
  x: 0.07,
  y,
  w: 0.38,
  h,
  confidence: 90,
});
const page = (lines: TextLine[]): DocumentPage => ({
  id: "p",
  index: 0,
  asset: {
    id: "a",
    blob: new Blob(),
    mime: "image/png",
    width: 1600,
    height: 2200,
  },
  method: "ocr",
  lines,
  warnings: [],
});
test("next-start candidate is not silently used as a validated content bound", () => {
  const p = page([
    line("1. 다음 함수의 값을", 0.12),
    line("구하시오. [3점]", 0.22),
    line("handwritten working", 0.6),
  ]);
  const content = assessContent(p, f, "question");
  assert.equal(content.state, "proposal");
  assert.ok(content.proposal!.h < rect.h);
  const reviewed = { ...f, candidateRect: { ...rect }, content };
  assert.deepEqual(reviewed.rect, rect);
  const applied = applyContentProposal(reviewed);
  assert.deepEqual(applied.rect, content.proposal);
  assert.deepEqual(applied.candidateRect, rect);
  assert.deepEqual(keepCandidate(applied).rect, rect);
});
test("tall formula intersecting closing line is retained by the proposed boundary", () => {
  const p = page([
    line("1. 계산하여 구하시오. [3점]", 0.2),
    line("tall fraction", 0.21, 0.08),
  ]);
  const c = assessContent(p, f, "question");
  assert.ok(c.proposal!.y + c.proposal!.h >= 0.29);
});
test("diagram/choice/answer-area references and uncertain endings preserve the source", () => {
  for (const text of [
    "다음 그림의 값을 구하시오. [3점]",
    "보기에서 고르시오. [3점]",
    "빈칸에 쓰시오. [3점]",
    "사각형의 넓이를 구하시오. [3점]",
    "구하시오.",
  ])
    assert.equal(
      assessContent(page([line(text, 0.2)]), f, "question").proposal,
      undefined,
    );
});
test("shared passages and multi-page references keep their identity and original fragment order", () => {
  const pages = [page([line("구하시오. [3점]", 0.2)])];
  const pieces = withContentBounds(pages, [
    {
      id: "q",
      kind: "question",
      name: "q",
      materialIds: ["m"],
      dependencyIds: ["previous"],
      fragments: [f, { ...f, pageId: "missing" }],
      warnings: [],
    },
    {
      id: "m",
      kind: "passage",
      name: "material",
      fragments: [f],
      warnings: [],
    },
  ]);
  assert.deepEqual(pieces[0].materialIds, ["m"]);
  assert.deepEqual(
    pieces[0].fragments.map((x) => x.pageId),
    ["p", "missing"],
  );
  assert.equal(pieces[1].fragments[0].content!.proposal, undefined);
});
test("grouping includes a numerator crossing the question-start row", async () => {
  const { segmentDocument } = await import("./segment");
  const p = page([
    line("numerator", 0.18, 0.018),
    line("1. 다음 값", 0.19, 0.024),
    line("구하시오. [3점]", 0.23),
    line("2. 다음 문제", 0.6),
  ]);
  const piece = segmentDocument([p], "1").find((x) => x.number === 1)!;
  assert.ok(piece.fragments[0].rect.y < 0.18);
  assert.ok(piece.fragments[0].content!.proposal!.y < 0.18);
});
