/** Experimental registration model. The current UI importer is not migrated yet. */
export type Point = [number, number];
import type { Matrix3 } from "../pdf-region-engine/base-types";
export type { Matrix3 } from "../pdf-region-engine/base-types";
export type ReviewState = "candidate" | "confirmed" | "rejected";
export type SourceFragment = {
  id: string;
  documentId: string;
  pageIndex: number;
  sourceRef: string;
  polygon: Point[];
  analysisRect: [number, number, number, number];
  sourceToAnalysis: Matrix3;
  analysisToSource: Matrix3;
  readingOrder: number;
  indivisible: boolean;
  safeBreaks: number[]; // analysis pixel y offsets, only after verification
};
export type RegistrationNode = {
  id: string;
  kind: "question" | "material" | "choice" | "unassigned";
  originalLabel?: string;
  sectionId: string | null;
  fragmentIds: string[];
  requiredMaterialIds: string[];
  parentId?: string;
  dependencyIds: string[];
  state: "review" | "ready" | "incomplete";
  reasons: string[];
  quality: Record<
    "boundary" | "order" | "material" | "completeness",
    "unknown" | "verified" | "failed"
  >;
};
export type Relation = {
  id: string;
  from: string;
  to: string;
  kind:
    | "continues"
    | "belongs_to"
    | "choice_of"
    | "requires_material"
    | "child_of"
    | "depends_on";
  state: ReviewState;
  evidence: {
    fragmentIds: string[];
    text?: string;
    method: "rule" | "ocr" | "model" | "human";
  };
};
export type RegistrationGraph = {
  version: "0.1";
  document: {
    id: string;
    sha256: string;
    sourceRef: string;
    pageCount: number;
    analysisVersion: string;
  };
  fragments: SourceFragment[];
  nodes: RegistrationNode[];
  relations: Relation[];
};
export function transform(m: Matrix3, [x, y]: Point): Point {
  const d = m[6] * x + m[7] * y + m[8];
  if (!Number.isFinite(d) || Math.abs(d) < 1e-12)
    throw new Error("Non-invertible coordinate");
  return [(m[0] * x + m[1] * y + m[2]) / d, (m[3] * x + m[4] * y + m[5]) / d];
}
export function invert(m: Matrix3): Matrix3 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const v: Matrix3 = [
    e * i - f * h,
    c * h - b * i,
    b * f - c * e,
    f * g - d * i,
    a * i - c * g,
    c * d - a * f,
    d * h - e * g,
    b * g - a * h,
    a * e - b * d,
  ];
  const det = a * v[0] + b * v[3] + c * v[6];
  if (Math.abs(det) < 1e-12) throw new Error("Singular transform");
  return v.map((x) => x / det) as Matrix3;
}
export function validateGraph(g: RegistrationGraph): string[] {
  const errors: string[] = [];
  const ids = [...g.nodes.map((n) => n.id), ...g.fragments.map((f) => f.id)];
  if (new Set(ids).size !== ids.length) errors.push("duplicate_id");
  const fragments = new Set(g.fragments.map((f) => f.id)),
    nodes = new Set(g.nodes.map((n) => n.id));
  for (const f of g.fragments) {
    if (
      f.documentId !== g.document.id ||
      f.pageIndex < 0 ||
      f.pageIndex >= g.document.pageCount
    )
      errors.push(`source:${f.id}`);
    if (f.polygon.some((p) => p.some((x) => !Number.isFinite(x))))
      errors.push(`coordinate:${f.id}`);
    for (const p of f.polygon) {
      const q = transform(f.analysisToSource, transform(f.sourceToAnalysis, p));
      if (Math.hypot(q[0] - p[0], q[1] - p[1]) > 1e-5)
        errors.push(`transform:${f.id}`);
    }
  }
  for (const n of g.nodes) {
    if (!n.fragmentIds.length || n.fragmentIds.some((id) => !fragments.has(id)))
      errors.push(`fragment_ref:${n.id}`);
    if (
      [
        ...n.requiredMaterialIds,
        ...n.dependencyIds,
        ...(n.parentId ? [n.parentId] : []),
      ].some((id) => !nodes.has(id))
    )
      errors.push(`node_ref:${n.id}`);
    if (
      n.requiredMaterialIds.some(
        (id) => g.nodes.find((x) => x.id === id)?.kind !== "material",
      )
    )
      errors.push(`material_type:${n.id}`);
  }
  for (const r of g.relations) {
    if (
      !ids.includes(r.from) ||
      !ids.includes(r.to) ||
      r.evidence.fragmentIds.some((id) => !fragments.has(id))
    )
      errors.push(`relation_ref:${r.id}`);
  }
  // Cycles in each directed relation type are contradictory. Ownership is fragment -> node.
  for (const kind of [
    "continues",
    "requires_material",
    "depends_on",
    "child_of",
  ] as const) {
    const visiting = new Set<string>(),
      done = new Set<string>();
    const visit = (id: string): boolean => {
      if (visiting.has(id)) return true;
      if (done.has(id)) return false;
      visiting.add(id);
      for (const e of g.relations.filter(
        (r) => r.state === "confirmed" && r.kind === kind && r.from === id,
      )) {
        if (visit(e.to)) return true;
      }
      const node = g.nodes.find((n) => n.id === id);
      const derived =
        kind === "requires_material"
          ? node?.requiredMaterialIds
          : kind === "depends_on"
            ? node?.dependencyIds
            : kind === "child_of" && node?.parentId
              ? [node.parentId]
              : [];
      for (const target of derived ?? []) if (visit(target)) return true;
      visiting.delete(id);
      done.add(id);
      return false;
    };
    if (ids.some(visit)) errors.push(`cycle:${kind}`);
  }
  return [...new Set(errors)];
}
/** Does not silently confirm candidates or select dependent questions. */
export function planReuse(g: RegistrationGraph, selectedIds: string[]) {
  const issues = validateGraph(g),
    selected = new Set(selectedIds),
    seen = new Set<string>(),
    ordered: RegistrationNode[] = [];
  if (!selectedIds.length) issues.push("empty_selection");
  const visit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const n = g.nodes.find((n) => n.id === id);
    if (!n) {
      issues.push(`missing:${id}`);
      return;
    }
    if (
      n.state !== "ready" ||
      Object.values(n.quality).some((value) => value !== "verified")
    )
      issues.push(`review:${id}`);
    const owned = new Set([id, ...n.fragmentIds]);
    if (
      g.relations.some(
        (r) =>
          r.state === "candidate" && (owned.has(r.from) || owned.has(r.to)),
      )
    )
      issues.push(`unresolved:${id}`);
    const materialIds = new Set([
      ...n.requiredMaterialIds,
      ...g.relations
        .filter(
          (r) =>
            r.from === id &&
            r.kind === "requires_material" &&
            r.state === "confirmed",
        )
        .map((r) => r.to),
    ]);
    for (const mid of materialIds) visit(mid);
    const deps = new Set([
      ...n.dependencyIds,
      ...g.relations
        .filter(
          (r) =>
            r.from === id && r.kind === "depends_on" && r.state === "confirmed",
        )
        .map((r) => r.to),
    ]);
    for (const dep of deps)
      if (!selected.has(dep)) issues.push(`requires_question:${id}:${dep}`);
    ordered.push(n);
  };
  for (const id of selectedIds) {
    if (g.nodes.find((n) => n.id === id)?.kind !== "question")
      issues.push(`not_question:${id}`);
    visit(id);
  }
  return {
    printable: issues.length === 0,
    issues: [...new Set(issues)],
    units: ordered.map((n) => ({
      nodeId: n.id,
      kind: n.kind,
      fragmentIds: n.fragmentIds,
    })),
  };
}
