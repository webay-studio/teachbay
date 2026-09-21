import test from "node:test";
import assert from "node:assert/strict";
import { snapshotQuestion, renderUnits, dependencyErrors } from "./reuse";
import { paginate } from "./layout";
import { reviewErrors } from "./documents/review";
import type { Question, StoredDocument, StoredFragment } from "./types";
import { defaults } from "./types";
const q = (id: string): Question => ({
  id,
  name: id,
  assetId: id,
  filename: "source.pdf",
  memo: "",
  createdAt: "now",
  updatedAt: "now",
  source: { documentId: "d", kind: "question", pages: [1] },
});
const fragment = (id: string): StoredFragment => ({
  id,
  assetId: id,
  pageIndex: 0,
  pageAssetId: "page",
  rect: { x: 0, y: 0, w: 1, h: 1 },
  polygon: [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ],
  sourceToAnalysis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  analysisToSource: [1, 0, 0, 0, 1, 0, 0, 0, 1],
});
test("deleted library material resolves from immutable source document; frozen snapshot does not change", () => {
  const m = {
      ...q("m"),
      source: { documentId: "d", kind: "passage" as const, pages: [1] },
    },
    one = {
      ...q("one"),
      materialIds: ["m"],
      fragments: [fragment("a"), fragment("b")],
    };
  const doc: StoredDocument = {
    id: "d",
    filename: "source.pdf",
    blob: new Blob(["original"]),
    sha256: "hash",
    version: 2,
    pages: [],
    items: [m, one],
    relations: [],
  };
  const snapshot = snapshotQuestion(one, [doc], [one]);
  m.name = "changed";
  assert.equal(snapshot.materials![0].name, "m");
  assert.equal(snapshot.fragments!.length, 2);
  const two = snapshotQuestion({ ...q("two"), materialIds: ["m"] }, [doc], []);
  const units = renderUnits([snapshot, two]);
  assert.deepEqual(
    units.map((u) => u.assetId),
    ["m", "a", "b", "two"],
  );
  assert.deepEqual(
    units.map((u) => u.displayNumber),
    [0, 1, 1, 2],
  );
});
test("separate fragments paginate intact without constructing a giant image", () => {
  const item = {
    ...q("one"),
    fragments: [fragment("a"), fragment("b"), fragment("c")],
  };
  const assets = new Map(
    ["a", "b", "c"].map((id) => [
      id,
      { id, mime: "image/png", blob: new Blob(), width: 1000, height: 1900 },
    ]),
  );
  const pages = paginate([item], assets, { ...defaults, columns: 1 });
  assert.equal(pages.length, 3);
  assert.deepEqual(
    pages.flatMap((p) => p.columns.flat()).map((p) => p.item.assetId),
    ["a", "b", "c"],
  );
});
test("review rejects missing material, cycles and unconfirmed boundaries", () => {
  const p = {
    id: "q",
    kind: "question" as const,
    name: "q",
    fragments: [],
    warnings: [],
    materialIds: ["missing"],
  };
  assert.equal(reviewErrors([p]).length, 2);
  assert.ok(
    reviewErrors([
      { ...p, confirmed: true, materialIds: [], dependencyIds: ["q"] },
    ]).some((s) => s.includes("순환")),
  );
  assert.equal(
    dependencyErrors([
      { id: "q", name: "q", assetId: "a", dependencyIds: ["other"] },
    ]).length,
    1,
  );
});
