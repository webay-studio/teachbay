import test from "node:test";
import assert from "node:assert/strict";
import {
  automaticPrintErasures,
  fragmentErasures,
  intersectRect,
  type PrintToken,
} from "./print-cleanup";
import type { DocumentPage, Piece } from "./types";
const token = (text: string, x: number, y = 0.12, w = 0.02): PrintToken => ({
  text,
  x,
  y,
  w,
  h: 0.015,
  confidence: 100,
  group: "pdf",
});
function fixture(tokens: PrintToken[]) {
  const page: DocumentPage = {
    id: "p",
    index: 0,
    asset: {
      id: "a",
      blob: new Blob(),
      mime: "image/png",
      width: 1000,
      height: 1400,
    },
    lines: [],
    printTokens: tokens,
    method: "text",
    warnings: [],
  };
  const piece: Piece = {
    id: "q",
    name: "1번",
    kind: "question",
    number: 1,
    fragments: [{ pageId: "p", rect: { x: 0.1, y: 0.1, w: 0.6, h: 0.5 } }],
    warnings: [],
  };
  return { page, piece };
}
test("erases located number and split score glyphs, preserves all body/math/choices", () => {
  const { page, piece } = fixture([
    token("1.", 0.11),
    token("Find the value", 0.15, 0.12, 0.3),
    token("[", 0.5, 0.18, 0.008),
    token("3", 0.51, 0.18, 0.01),
    token("점", 0.523, 0.18, 0.016),
    token("]", 0.54, 0.18, 0.008),
    token("① 1", 0.11, 0.3, 0.05),
    token("두 점", 0.2, 0.22, 0.07),
    token("1", 0.11, 0.35),
  ]);
  const masks = automaticPrintErasures(page, piece, 0);
  assert.equal(masks.length, 2);
  for (const body of page.printTokens!.filter((t) =>
    ["Find the value", "① 1", "두 점"].includes(t.text),
  ))
    assert(!masks.some((m) => intersectRect(m, body)));
  assert(masks.some((m) => m.x < 0.11 && m.x + m.w > 0.13));
  assert(masks.some((m) => m.x < 0.5 && m.x + m.w > 0.548));
});
test("does not estimate substring geometry, erase low confidence, or mix OCR passes", () => {
  const { page, piece } = fixture([
    token("1. Solve x", 0.11, 0.12, 0.3),
    token("본문 [3점]", 0.15, 0.2, 0.3),
    { ...token("[3점]", 0.4, 0.3, 0.06), confidence: 50 },
    token("[", 0.5, 0.4, 0.008),
    { ...token("3점]", 0.51, 0.4, 0.04), group: "another-pass" },
  ]);
  assert.deepEqual(automaticPrintErasures(page, piece, 0), []);
});
test("continuations and passages keep leading numbers, automatic cleanup is reversible", () => {
  const { page, piece } = fixture([
    token("1.", 0.11),
    token("[3점]", 0.4, 0.2, 0.06),
  ]);
  piece.fragments.push({ ...piece.fragments[0] });
  assert.equal(automaticPrintErasures(page, piece, 1).length, 1);
  assert.deepEqual(
    automaticPrintErasures(page, { ...piece, kind: "passage" }, 0),
    [],
  );
  assert.deepEqual(
    automaticPrintErasures(page, { ...piece, cleanPrint: false }, 0),
    [],
  );
});
test("manual erasures are clipped to edited bounds and survive auto-cleanup being disabled", () => {
  const { page, piece } = fixture([]);
  piece.cleanPrint = false;
  piece.fragments[0].erasures = [
    { x: 0, y: 0, w: 0.2, h: 0.2 },
    { x: 0.8, y: 0.8, w: 0.1, h: 0.1 },
  ];
  assert.deepEqual(fragmentErasures(page, piece, 0), [
    { x: 0.1, y: 0.1, w: 0.1, h: 0.1 },
  ]);
  assert.equal(piece.fragments[0].erasures.length, 2);
});

test("bare numbers require a number-only source part; split punctuation is retained in mask", () => {
  const { page, piece } = fixture([token("1", 0.11)]);
  assert.deepEqual(automaticPrintErasures(page, piece, 0), []);
  piece.fragments[0].numberOnly = true;
  assert.equal(automaticPrintErasures(page, piece, 0).length, 1);
  piece.fragments[0].numberOnly = false;
  page.printTokens!.push(token(".", 0.131, 0.12, 0.006));
  assert.equal(automaticPrintErasures(page, piece, 0).length, 1);
  assert(automaticPrintErasures(page, piece, 0)[0].w > 0.027);
});

test("a complete OCR score line works when individual glyph boxes cannot be joined", () => {
  const { page, piece } = fixture([
    token("[", 0.5, 0.2, 0.008),
    token("3", 0.51, 0.204, 0.01),
    token("점]", 0.523, 0.2, 0.025),
  ]);
  page.lines = [
    { text: "[3점]", x: 0.5, y: 0.2, w: 0.048, h: 0.02, confidence: 93 },
  ];
  const masks = automaticPrintErasures(page, piece, 0);
  assert(masks.some((m) => m.x < 0.5 && m.x + m.w > 0.548));
});

test("padding removes glyph edges without entering adjacent recognized body", () => {
  const body = token("본문", 0.131, 0.12, 0.05);
  const { page, piece } = fixture([token("1.", 0.11), body]);
  const masks = automaticPrintErasures(page, piece, 0);
  assert.equal(masks.length, 1);
  assert(!intersectRect(masks[0], body));
});
