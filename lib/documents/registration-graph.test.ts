import test from "node:test";
import assert from "node:assert/strict";
import {
  invert,
  transform,
  planReuse,
  validateGraph,
  type Matrix3,
  type RegistrationGraph,
  type RegistrationNode,
} from "./registration-graph";
const identity: Matrix3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
function fixture(): RegistrationGraph {
  const node = (
    id: string,
    kind: RegistrationNode["kind"],
  ): RegistrationNode => ({
    id,
    kind,
    sectionId: "s1",
    fragmentIds: [`f-${id}`],
    requiredMaterialIds: kind === "question" ? ["m"] : [],
    dependencyIds: [],
    state: "ready",
    reasons: [],
    quality: {
      boundary: "verified",
      order: "verified",
      material: "verified",
      completeness: "verified",
    },
  });
  const nodes = [
    node("q1", "question"),
    node("q2", "question"),
    node("m", "material"),
  ];
  return {
    version: "0.1",
    document: {
      id: "d",
      sha256: "fixture",
      sourceRef: "fixture.pdf",
      pageCount: 2,
      analysisVersion: "test",
    },
    nodes,
    relations: [],
    fragments: nodes.map((n, i) => ({
      id: n.fragmentIds[0],
      documentId: "d",
      pageIndex: i % 2,
      sourceRef: "fixture.pdf",
      polygon: [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ],
      analysisRect: [0, 0, 10, 10],
      sourceToAnalysis: identity,
      analysisToSource: identity,
      readingOrder: i,
      indivisible: true,
      safeBreaks: [],
    })),
  };
}
test("rotation, crop and perspective transforms round-trip", () => {
  for (const m of [
    [0, -2, 300, 2, 0, -10, 0, 0, 1],
    [1, 0.2, 3, 0.1, 1, 4, 0.001, 0.002, 1],
  ] as Matrix3[]) {
    const p: [number, number] = [50, 90],
      q = transform(invert(m), transform(m, p));
    assert.ok(Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-8);
  }
  assert.throws(() => invert([0, 0, 0, 0, 0, 0, 0, 0, 0]));
});
test("shared material appears once, sibling question is not selected", () => {
  const g = fixture();
  assert.deepEqual(
    planReuse(g, ["q1"]).units.map((u) => u.nodeId),
    ["m", "q1"],
  );
  assert.deepEqual(
    planReuse(g, ["q2", "q1"]).units.map((u) => u.nodeId),
    ["m", "q2", "q1"],
  );
  assert.equal(planReuse(g, ["q1"]).printable, true);
});
test("unresolved continuation and missing dependencies block printing", () => {
  const g = fixture();
  g.nodes[0].dependencyIds = ["q2"];
  g.relations.push({
    id: "r",
    from: "f-q1",
    to: "f-q2",
    kind: "continues",
    state: "candidate",
    evidence: { fragmentIds: ["f-q1"], method: "rule" },
  });
  const p = planReuse(g, ["q1"]);
  assert.equal(p.printable, false);
  assert.ok(p.issues.includes("unresolved:q1"));
  assert.ok(p.issues.includes("requires_question:q1:q2"));
});
test("dangling source, contradictory continuation cycle are rejected", () => {
  const g = fixture();
  g.fragments[0].pageIndex = 5;
  for (const [from, to] of [
    ["f-q1", "f-q2"],
    ["f-q2", "f-q1"],
  ])
    g.relations.push({
      id: from,
      from,
      to,
      kind: "continues",
      state: "confirmed",
      evidence: { fragmentIds: [from], method: "human" },
    });
  assert.ok(validateGraph(g).includes("cycle:continues"));
  assert.ok(validateGraph(g).includes("source:f-q1"));
});
test("same original number is allowed across sections; missing fragments rejected", () => {
  const g = fixture();
  g.nodes[0].originalLabel = g.nodes[1].originalLabel = "1";
  g.nodes[1].sectionId = "s2";
  assert.deepEqual(validateGraph(g), []);
  g.nodes[0].fragmentIds = ["missing"];
  assert.ok(validateGraph(g).includes("fragment_ref:q1"));
});
test("material cycles and empty selections cannot produce a printable plan", () => {
  const g = fixture();
  g.nodes[2].requiredMaterialIds = ["m"];
  assert.equal(planReuse(g, ["q1"]).printable, false);
  assert.ok(validateGraph(g).includes("cycle:requires_material"));
  assert.equal(planReuse(fixture(), []).printable, false);
});
