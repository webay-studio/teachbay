import test from "node:test";
import assert from "node:assert/strict";
import type { PendingQuestion, Piece } from "./types";
import {
  bundleRegistrationRows,
  autoBundlePassages,
  registrationUnitCount,
  setPassageBundle,
  toggleBundleSelection,
} from "./passage-bundles";
import { reviewErrors, selectedPiecesForRegistration } from "./review";
import { renderUnits, snapshotQuestion } from "../reuse";
import type { Question } from "../types";
function fixture(): Piece[] {
  return [
    {
      id: "p",
      name: "지문",
      kind: "passage" as const,
      fragments: [{ pageId: "page", rect: { x: 0, y: 0, w: 0.4, h: 0.2 } }],
      warnings: [],
      confirmed: true,
    },
    ...[1, 2, 3, 4].map((n) => ({
      id: `q${n}`,
      name: `${n}번`,
      kind: "question" as const,
      number: n,
      sectionId: "a",
      fragments: [
        { pageId: "page", rect: { x: 0, y: 0.2 * n, w: 0.4, h: 0.15 } },
      ],
      warnings: [],
      confirmed: true,
    })),
  ];
}
function rows(pieces: Piece[]): PendingQuestion[] {
  return pieces.map((p) => ({
    id: p.id,
    name: p.name,
    filename: "fixture.pdf",
    memo: "",
    asset: {
      id: `asset-${p.id}`,
      blob: new Blob(),
      mime: "image/png",
      width: 400,
      height: 200,
    },
    source: { kind: p.kind, documentId: "doc", pages: [1] },
    materialIds: p.materialIds,
    dependencyIds: p.dependencyIds,
    fragments: p.fragments.map((f, i) => ({
      id: `${p.id}-f${i}`,
      assetId: `${p.id}-asset${i}`,
      pageAssetId: f.pageId,
      pageIndex: i,
      rect: f.rect,
      polygon: [],
      sourceToAnalysis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      analysisToSource: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    })),
  }));
}
test("range binds IDs and can narrow without leaving the old passage links", () => {
  const original = fixture(),
    grouped = setPassageBundle(original, "p", "q1", "q3");
  assert.deepEqual(grouped[0].bundleQuestionIds, ["q1", "q2", "q3"]);
  assert.equal(original[0].bundleQuestionIds, undefined);
  assert.deepEqual(grouped[2].materialIds, ["p"]);
  const narrowed = setPassageBundle(grouped, "p", "q2", "q3");
  assert.deepEqual(narrowed[1].materialIds, []);
  assert.throws(() => setPassageBundle(grouped, "p", "q3", "q1"), /順|순서/);
});
test("ranges cannot cross section restarts or put one question in two groups", () => {
  const grouped = setPassageBundle(fixture(), "p", "q1", "q2");
  grouped.push({ ...grouped[0], id: "other", bundleQuestionIds: undefined });
  assert.throws(
    () => setPassageBundle(grouped, "other", "q2", "q3"),
    /다른 지문/,
  );
  grouped[3] = { ...grouped[3], sectionId: "b", number: 1 };
  assert.throws(() => setPassageBundle(grouped, "p", "q2", "q3"), /같은 영역/);
});
test("selecting a group member includes its whole group; toggling removes the whole unit", () => {
  const grouped = setPassageBundle(fixture(), "p", "q1", "q3");
  const selected = selectedPiecesForRegistration(grouped, ["q2"]);
  assert.deepEqual(
    selected.map((p) => p.id),
    ["p", "q1", "q2", "q3"],
  );
  assert.equal(registrationUnitCount(selected), 1);
  assert.deepEqual(
    toggleBundleSelection(grouped, ["p", "q1", "q2", "q3", "q4"], "q1", false),
    ["q4"],
  );
  assert.deepEqual(
    selectedPiecesForRegistration(fixture(), ["q2"]).map((p) => p.id),
    ["q2"],
  );
});
test("published bundle keeps passage then all member fragments and rewrites dependencies", () => {
  const grouped = setPassageBundle(fixture(), "p", "q1", "q3");
  grouped[1].fragments.push({ ...grouped[1].fragments[0], pageId: "page2" });
  grouped[2].dependencyIds = ["q1"];
  grouped[3].dependencyIds = ["q4"];
  grouped[4].dependencyIds = ["q2"];
  const sourceRows = rows(grouped),
    published = bundleRegistrationRows(grouped, sourceRows);
  assert.deepEqual(
    published.map((r) => r.id),
    ["p:bundle", "q4"],
  );
  assert.equal(published[0].name, "1–3번 지문 묶음");
  assert.deepEqual(
    published[0].fragments!.map((f) => f.id),
    ["p-f0", "q1-f0", "q1-f1", "q2-f0", "q3-f0"],
  );
  assert.deepEqual(published[0].materialIds, []);
  assert.deepEqual(published[0].dependencyIds, ["q4"]);
  assert.deepEqual(published[1].dependencyIds, ["p:bundle"]);
  assert.equal(sourceRows[0].source?.kind, "passage");
});
test("one saved bundle stays one snapshot and keeps every fragment in print order", () => {
  const pieces = setPassageBundle(fixture(), "p", "q1", "q3");
  const row = bundleRegistrationRows(pieces, rows(pieces))[0];
  const q: Question = {
    ...row,
    assetId: row.asset.id,
    createdAt: "now",
    updatedAt: "now",
  };
  const snapshot = snapshotQuestion(q, [], []),
    units = renderUnits([snapshot]);
  assert.equal(snapshot.bundle?.questionIds.length, 3);
  assert.equal(units.length, 4);
  assert(units.every((u) => u.displayNumber === 1));
  assert.deepEqual(
    units.map((u) => u.assetId),
    row.fragments!.map((f) => f.assetId),
  );
});
test("missing or multiply grouped members cannot pass save validation", () => {
  const grouped = setPassageBundle(fixture(), "p", "q1", "q2").map((p) => ({
    ...p,
    confirmed: true,
  }));
  assert.deepEqual(reviewErrors(grouped), []);
  assert(
    reviewErrors(grouped.filter((p) => p.id !== "q2")).some((s) =>
      s.includes("묶음"),
    ),
  );
  grouped.push({ ...grouped[0], id: "p2" });
  assert(reviewErrors(grouped).some((s) => s.includes("여러 지문")));
});

test("fresh linked passages become one registration unit without changing source regions", () => {
  const original = fixture().map((p) =>
    p.kind === "question" && p.id !== "q4" ? { ...p, materialIds: ["p"] } : p,
  );
  const grouped = autoBundlePassages(original);
  assert.deepEqual(grouped[0].bundleQuestionIds, ["q1", "q2", "q3"]);
  assert.equal(original[0].bundleQuestionIds, undefined);
  assert.equal(grouped[1], original[1]);
  assert.equal(grouped[0].fragments, original[0].fragments);
  const selected = selectedPiecesForRegistration(grouped, ["q2"]);
  assert.equal(registrationUnitCount(selected), 1);
  assert.deepEqual(
    bundleRegistrationRows(selected, rows(selected))[0].bundle?.questionIds,
    ["q1", "q2", "q3"],
  );
  const ungrouped = grouped.map((p) =>
    p.id === "p" ? { ...p, bundleQuestionIds: undefined } : p,
  );
  assert.deepEqual(
    selectedPiecesForRegistration(ungrouped, ["q2"]).map((p) => p.id),
    ["p", "q2"],
  );
});

test("automatic grouping uses existing links only and leaves ambiguous ownership untouched", () => {
  const original = fixture().map((p) =>
    p.id === "q1" || p.id === "q3" ? { ...p, materialIds: ["p"] } : p,
  );
  assert.deepEqual(autoBundlePassages(original)[0].bundleQuestionIds, [
    "q1",
    "q3",
  ]);
  const overlapping = [...original, { ...original[0], id: "other" }].map((p) =>
    p.id === "q3" ? { ...p, materialIds: ["p", "other"] } : p,
  );
  assert(autoBundlePassages(overlapping).every((p) => !p.bundleQuestionIds));
  const crossSection = original.map((p) =>
    p.id === "q3" ? { ...p, sectionId: "b" } : p,
  );
  assert(autoBundlePassages(crossSection).every((p) => !p.bundleQuestionIds));
  assert(autoBundlePassages(fixture()).every((p) => !p.bundleQuestionIds));
  const explicit = setPassageBundle(original, "p", "q1", "q2");
  assert.deepEqual(autoBundlePassages(explicit), explicit);
});
