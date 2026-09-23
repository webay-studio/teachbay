import assert from "node:assert/strict";
import test from "node:test";
import {
  drawRegion,
  moveRegion,
  resizeRegion,
  REGION_HANDLES,
} from "./region-edit";

test("moving beyond a page edge preserves the entire fragment and its dimensions", () => {
  const rect = { x: 0.2, y: 0.3, w: 0.25, h: 0.4 };
  assert.deepEqual(moveRegion(rect, 5, -5), { x: 0.75, y: 0, w: 0.25, h: 0.4 });
  assert.deepEqual(rect, { x: 0.2, y: 0.3, w: 0.25, h: 0.4 });
});

test("all resize handles stay in the page and cannot invert the rectangle", () => {
  const rect = { x: 0.2, y: 0.3, w: 0.25, h: 0.4 };
  for (const handle of REGION_HANDLES)
    for (const dx of [-5, 0, 5])
      for (const dy of [-5, 0, 5]) {
        const next = resizeRegion(rect, handle, dx, dy);
        assert(next.x >= 0 && next.y >= 0);
        assert(next.w >= 0.01 - 1e-10 && next.h >= 0.005 - 1e-10);
        assert(next.x + next.w <= 1 + 1e-10 && next.y + next.h <= 1 + 1e-10);
        if (handle.includes("w"))
          assert(Math.abs(next.x + next.w - (rect.x + rect.w)) < 1e-10);
        if (handle.includes("n"))
          assert(Math.abs(next.y + next.h - (rect.y + rect.h)) < 1e-10);
      }
});

test("drawing backwards and releasing outside the page clips only the drawn bounds", () => {
  assert.deepEqual(drawRegion({ x: 0.75, y: 0.8 }, { x: -1, y: -1 }), {
    x: 0,
    y: 0,
    w: 0.75,
    h: 0.8,
  });
});
