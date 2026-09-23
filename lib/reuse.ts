import type { Question, Snapshot, StoredDocument } from "./types";
export function snapshotQuestion(
  q: Question,
  documents: StoredDocument[],
  library: Question[],
  stack = new Set<string>(),
): Snapshot {
  if (stack.has(q.id))
    throw new Error("공통 자료 연결이 순환합니다. 연결을 확인해주세요.");
  const next = new Set(stack).add(q.id);
  const materials = (q.materialIds ?? []).map((id) => {
    const material =
      documents
        .find((d) => d.id === q.source?.documentId)
        ?.items.find((x) => x.id === id) ?? library.find((x) => x.id === id);
    if (!material || material.source?.kind !== "passage")
      throw new Error(`${q.name}: 필요한 공통 자료를 찾을 수 없습니다.`);
    return snapshotQuestion(material, documents, library, next);
  });
  return structuredClone({
    id: q.id,
    bundle: q.bundle,
    name: q.name,
    assetId: q.assetId,
    fragments: q.fragments,
    materials,
    dependencyIds: q.dependencyIds,
    sectionId: q.sectionId,
    originalLabel: q.originalLabel,
    kind: q.source?.kind,
  });
}
export type RenderUnit = Snapshot & {
  displayNumber: number;
  continuation: boolean;
  last: boolean;
};
export function renderUnits(items: Snapshot[]): RenderUnit[] {
  const units: RenderUnit[] = [],
    seen = new Set<string>();
  let number = 0;
  function add(item: Snapshot, isMaterial = false) {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    for (const m of item.materials ?? []) add(m, true);
    const n = isMaterial || item.kind === "passage" ? 0 : ++number;
    const assets = item.fragments?.length
      ? item.fragments.map((f) => f.assetId)
      : [item.assetId];
    assets.forEach((assetId, i) =>
      units.push({
        ...item,
        id: i === 0 ? item.id : `${item.id}:fragment:${i}`,
        assetId,
        displayNumber: n,
        continuation: i > 0,
        last: i === assets.length - 1,
      }),
    );
  }
  items.forEach((i) => add(i));
  return units;
}
export function dependencyErrors(items: Snapshot[]): string[] {
  const selected = new Set(items.map((i) => i.id));
  const errors: string[] = [];
  for (const q of items)
    for (const id of q.dependencyIds ?? [])
      if (!selected.has(id))
        errors.push(
          `${q.name}: 조건이나 결과를 참조하는 다른 문항을 함께 선택해주세요.`,
        );
  return errors;
}
