import test from "node:test";
import assert from "node:assert/strict";
import { numberRetryCrops } from "./ocr-retries";
import type { EvidenceLine } from "./structure-experiment";
test("number retry is bounded and does not count duplicate OCR passes as more locations", () => {
  const lines: EvidenceLine[] = Array.from({ length: 20 }, (_, i) => ({
    id: String(i),
    page: 0,
    source: "ocr",
    role: "unassigned",
    reasons: [],
    text: "5 함수의 값을 구하시오.",
    confidence: 65,
    x: 0.04,
    y: 0.12 + Math.floor(i / 2) * 0.065,
    w: 0.36,
    h: 0.015,
    passId: "pass-" + (i % 2),
  }));
  const crops = numberRetryCrops(lines, [{ x: 0, y: 0, w: 0.48, h: 1 }], 4);
  assert.equal(crops.length, 4);
  assert.equal(new Set(crops.map((r) => r.y)).size, 4);
  assert.ok(crops.every((r) => r.y >= 0 && r.y + r.h <= 1 && r.h < 0.05));
});
