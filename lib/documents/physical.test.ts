import test from "node:test";
import assert from "node:assert/strict";
import { physicalRegions } from "./physical";

function page() {
  const width = 400,
    height = 600;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const rule = (x: number, top: number, bottom: number) => {
    for (let y = top; y < bottom; y++) {
      const i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 0;
    }
  };
  rule(200, 50, 570);
  return { data, width, height, rule };
}

test("separate material box edges cannot exclude a whole column's question numbers", () => {
  const p = page();
  // >40% total dark coverage, but three separate boxes rather than an outer frame.
  for (const x of [48, 356]) {
    p.rule(x, 75, 175);
    p.rule(x, 245, 345);
    p.rule(x, 415, 515);
  }
  const lanes = physicalRegions(p.data, p.width, p.height);
  assert.equal(lanes.length, 2);
  assert.equal(lanes[0].x, 0.029);
  assert.equal(lanes[1].x + lanes[1].w, 0.971);
  assert.ok(0.104 >= lanes[0].x); // A printed number remains eligible for ownership.
});

test("genuine long outer rules are retained, including small scan gaps", () => {
  const p = page();
  for (const x of [32, 368]) {
    p.rule(x, 50, 570);
    for (let y = 120; y < 560; y += 80) {
      const i = (y * p.width + x) * 4;
      p.data[i] = p.data[i + 1] = p.data[i + 2] = 255;
    }
  }
  const lanes = physicalRegions(p.data, p.width, p.height);
  assert.equal(lanes[0].x, 0.084);
  assert.equal(lanes[1].x + lanes[1].w, 0.916);
});
