import test from "node:test";
import assert from "node:assert/strict";
import {
  detectColumns,
  joinLines,
  marker,
  mergePieces,
  segmentDocument,
  splitFragment,
} from "./segment";
import type { DocumentPage, TextLine } from "./types";
const line = (text: string, x: number, y: number, w = 0.32): TextLine => ({
  text,
  x,
  y,
  w,
  h: 0.015,
});
const page = (
  index: number,
  lines: TextLine[],
  method: DocumentPage["method"] = "text",
): DocumentPage => ({
  id: `p${index}`,
  index,
  lines,
  method,
  warnings: [],
  asset: {
    id: `a${index}`,
    blob: new Blob(),
    mime: "image/png",
    width: 1600,
    height: 2200,
  },
});
test("recognizes question and passage markers, not decimals or circled choices", () => {
  assert.deepEqual(marker("[12~14] 다음 글을 읽고"), {
    kind: "passage",
    group: "12–14",
  });
  assert.deepEqual(marker("23. 다음 중 옳은 것은?"), {
    kind: "question",
    number: 23,
  });
  assert.equal(marker("① 첫 번째 선택지"), undefined);
  assert.equal(marker("3.14는 원주율"), undefined);
});
test("joins split number/text runs without joining across the gutter", () => {
  const result = joinLines([
    line("1.", 0.07, 0.1, 0.015),
    line("다음 글을 읽으시오", 0.095, 0.1, 0.25),
    line("다음 단", 0.55, 0.1, 0.3),
  ]);
  assert.equal(result.length, 2);
  assert.equal(marker(result[0].text)?.number, 1);
});
test("cross-column continuation stays separate until reviewed; shared reference is suggested", () => {
  const pieces = segmentDocument(
    [
      page(0, [
        line("[1-2] Read the passage.", 0.07, 0.1),
        line("Shared text", 0.07, 0.2),
        line("1. First question", 0.07, 0.5),
        line("B. Continued choice", 0.55, 0.1),
        line("Explain your choice", 0.55, 0.15),
        line("More details", 0.55, 0.2),
        line("2. Next question", 0.55, 0.5),
      ]),
    ],
    "2",
  );
  const q = pieces.filter((p) => p.kind === "question"),
    m = pieces.find((p) => p.kind === "passage")!,
    unassigned = pieces.find((p) => p.continuationOf);
  assert.equal(q.length, 2);
  assert.ok(q.every((p) => p.fragments.length === 1));
  assert.equal(unassigned?.continuationOf, q[0].id);
  assert.deepEqual(q[1].materialIds, [m.id]);
});
test("open passages can span many pages without automatic ownership", () => {
  const pieces = segmentDocument(
    [
      page(0, [line("[1-2] Read the passage", 0.08, 0.1)]),
      page(1, [line("Passage continues", 0.08, 0.1)]),
      page(2, [
        line("Passage continues again", 0.08, 0.1),
        line("1. Question", 0.08, 0.5),
        line("2. Question", 0.08, 0.8),
      ]),
    ],
    "1",
  );
  assert.equal(
    pieces.filter((p) => p.kind === "passage")[0].fragments.length,
    1,
  );
  assert.equal(pieces.filter((p) => p.kind === "other").length, 2);
  assert.equal(pieces.filter((p) => p.kind === "question").length, 2);
});
test("unread page is preserved and breaks uncertain continuation", () => {
  const pieces = segmentDocument(
    [
      page(0, [line("1. Question", 0.08, 0.1)]),
      page(1, [], "unread"),
      page(2, [line("Unnumbered new text", 0.08, 0.1)]),
    ],
    "1",
  );
  assert.equal(pieces.length, 3);
  assert.equal(pieces[1].fragments[0].rect.w, 1);
  assert.equal(pieces[2].kind, "other");
  assert.equal(pieces[0].fragments.length, 1);
});
test("manual split and merge preserve every region in reading order", () => {
  const pieces = segmentDocument(
    [page(0, [line("1. First", 0.08, 0.1), line("2. Second", 0.08, 0.5)])],
    "1",
  );
  const original = pieces[0].fragments[0].rect;
  const split = splitFragment(pieces[0], 0, 0.4);
  assert.equal(split.length, 2);
  assert.ok(
    Math.abs(
      split[0].fragments[0].rect.h + split[1].fragments[0].rect.h - original.h,
    ) < 1e-10,
  );
  const merged = mergePieces(
    [...split, pieces[1]],
    split.map((p) => p.id),
  );
  assert.equal(merged.length, 2);
  assert.equal(merged[0].fragments.length, 2);
  assert.equal(merged[1].id, pieces[1].id);
});
test("repeated headers and page numbers do not become continuation content", () => {
  const docs = [
    page(0, [
      line("Practice worksheet", 0.08, 0.04),
      line("1. First question", 0.08, 0.15),
      line("1", 0.48, 0.955, 0.02),
    ]),
    page(1, [
      line("Practice worksheet", 0.08, 0.04),
      line("Final choice for question one", 0.08, 0.12),
      line("2. Next question", 0.08, 0.4),
      line("2", 0.48, 0.955, 0.02),
    ]),
  ];
  const pieces = segmentDocument(docs, "1");
  assert.equal(pieces.length, 3);
  assert.equal(pieces[0].fragments.length, 1);
  assert.ok(pieces[1].fragments[0].rect.y > 0.1);
  assert.ok(
    pieces[2].fragments[0].rect.y + pieces[2].fragments[0].rect.h < 0.95,
  );
});
test("unnumbered passage prompt starts a separate shared passage", () => {
  const pieces = segmentDocument(
    [
      page(0, [
        line("1. First question", 0.08, 0.1),
        line("다음 글을 읽고 답하시오.", 0.08, 0.4),
        line("Long passage", 0.08, 0.45),
        line("2. Second question", 0.08, 0.7),
      ]),
    ],
    "1",
  );
  assert.deepEqual(
    pieces.map((p) => p.kind),
    ["question", "passage", "question"],
  );
  assert.equal(pieces[1].name, "공통 자료");
});

test("cover instructions cannot become questions and essay numbering is recognized", () => {
  const pieces = segmentDocument([
    page(0, [
      line("총(6)쪽 단답형(18)문항 서술형(4)문항", 0.1, 0.2),
      line("별도의 답안지", 0.1, 0.3),
      line("3) 문항에 따라 배점 확인", 0.1, 0.5),
    ]),
  ]);
  assert.equal(pieces.length, 1);
  assert.equal(pieces[0].kind, "other");
  assert.equal(marker("[서술형3] 다음 함수")?.number, 3);
});
