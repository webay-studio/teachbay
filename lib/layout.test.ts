import test from "node:test";
import assert from "node:assert/strict";
import { paginate } from "./layout";
import { defaults, ImageAsset, Snapshot } from "./types";
const image = (id: string, w: number, h: number): ImageAsset => ({
  id,
  width: w,
  height: h,
  blob: new Blob(),
  mime: "image/png",
});
test("preserves order and keeps every question in a complete column block", () => {
  const assets = new Map([["normal", image("normal", 1000, 750)]]);
  const items: Snapshot[] = Array.from({ length: 23 }, (_, n) => ({
    id: String(n),
    name: `Q${n}`,
    assetId: "normal",
  }));
  const pages = paginate(items, assets, defaults);
  assert.ok(pages.length > 1);
  assert.deepEqual(
    pages.flatMap((p) => p.columns.flatMap((c) => c.map((q) => q.item.id))),
    items.map((q) => q.id),
  );
  for (const p of pages)
    for (const c of p.columns)
      assert.ok(c.reduce((n, q) => n + q.height, 0) <= 239);
});
test("oversized images fit the body and report substantial shrinking", () => {
  const assets = new Map([["long", image("long", 100, 2000)]]);
  const pages = paginate(
    [{ id: "one", name: "long", assetId: "long" }],
    assets,
    defaults,
  );
  const q = pages[0].columns[0][0];
  assert.equal(q.height, 239);
  assert.equal(q.scaled, true);
  assert.ok(q.imageHeight > 0);
});
test("one and two columns and writing space change pagination", () => {
  const assets = new Map([["a", image("a", 1000, 500)]]);
  const items = Array.from({ length: 8 }, (_, n) => ({
    id: String(n),
    name: "question",
    assetId: "a",
  }));
  assert.ok(
    paginate(items, assets, { ...defaults, columns: 1 }).length >
      paginate(items, assets, defaults).length,
  );
  assert.ok(
    paginate(items, assets, { ...defaults, space: "large" }).length >=
      paginate(items, assets, { ...defaults, space: "small" }).length,
  );
  assert.deepEqual(paginate([], assets, defaults), []);
});
