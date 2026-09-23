import test from "node:test";
import assert from "node:assert/strict";
import { editableNodes, simpleLatex } from "./editable-preview";
const crop = { x: 0.1, y: 0.2, w: 0.5, h: 0.4 };
const token = {
  x: 0.2,
  y: 0.3,
  w: 0.1,
  h: 0.03,
  text: "문장을",
  confidence: 98,
};
test("editable layer maps coordinates, filters masks and never crops a partial token", () => {
  const nodes = editableNodes(
    [token, { ...token, x: 0.58, text: "밖으로" }],
    crop,
  );
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].mode, "text");
  assert.ok(Math.abs(nodes[0].rect.x - 0.2) < 1e-9);
  assert.ok(Math.abs(nodes[0].rect.y - 0.25) < 1e-9);
  assert.equal(
    editableNodes([token], crop, [{ x: 0.21, y: 0.3, w: 0.01, h: 0.03 }])
      .length,
    0,
  );
});
test("overlapping passes produce one layer without mutating source observations", () => {
  const input = [token, { ...token, confidence: 94, text: "다르게" }];
  const snapshot = structuredClone(input);
  assert.equal(editableNodes(input, crop).length, 1);
  assert.deepEqual(input, snapshot);
});
test("uncertain text, diagram labels and encoded equations retain the raster", () => {
  for (const t of [
    { ...token, confidence: 60 },
    { ...token, text: "A" },
    { ...token, text: "\uE000x\uE001" },
    { ...token, text: "√x+1" },
  ])
    assert.equal(editableNodes([t], crop)[0].mode, "image");
});
test("only explicit linear symbols convert; no inferred fraction or radical extent", () => {
  assert.equal(simpleLatex("x² + y³ ≤ 9"), "x^{2} + y^{3} \\le  9");
  assert.equal(simpleLatex("α×2"), "\\alpha \\times 2");
  for (const text of [
    "√x+1",
    "분수 1/2",
    "\\href{https://example.com}{x}",
    "\uE000",
  ])
    assert.equal(simpleLatex(text), undefined);
  assert.equal(editableNodes([{ ...token, text: "x²" }], crop)[0].mode, "math");
});
