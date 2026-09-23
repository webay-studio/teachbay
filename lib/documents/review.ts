import { bundleOwner } from "./passage-bundles";
import type { Piece } from "./types";
export function reviewErrors(pieces: Piece[]): string[] {
  const errors: string[] = [];
  const grouped = new Set<string>();
  for (const p of pieces) {
    if (p.bundleQuestionIds?.length) {
      if (p.kind !== "passage")
        errors.push("지문만 문제 묶음을 가질 수 있습니다.");
      for (const id of p.bundleQuestionIds) {
        const q = pieces.find((x) => x.id === id && x.kind === "question");
        if (!q || !q.materialIds?.includes(p.id))
          errors.push(`${p.name}: 묶음의 문제 연결을 확인해주세요.`);
        if (grouped.has(id))
          errors.push("한 문제를 여러 지문 묶음에 넣을 수 없습니다.");
        grouped.add(id);
      }
    }
    if (!p.confirmed) errors.push(`${p.name}: 경계·순서·연결을 확인해주세요.`);
    for (const id of p.materialIds ?? [])
      if (!pieces.some((x) => x.id === id && x.kind === "passage"))
        errors.push(`${p.name}: 공통 자료 연결이 유효하지 않습니다.`);
    for (const id of p.dependencyIds ?? [])
      if (!pieces.some((x) => x.id === id && x.kind === "question"))
        errors.push(`${p.name}: 의존 문항을 찾을 수 없습니다.`);
  }
  const visiting = new Set<string>(),
    done = new Set<string>();
  function visit(id: string): boolean {
    if (visiting.has(id)) return true;
    if (done.has(id)) return false;
    visiting.add(id);
    const p = pieces.find((p) => p.id === id);
    for (const to of [...(p?.materialIds ?? []), ...(p?.dependencyIds ?? [])])
      if (visit(to)) return true;
    visiting.delete(id);
    done.add(id);
    return false;
  }
  if (pieces.some((p) => visit(p.id)))
    errors.push("자료 또는 문항의 의존 관계가 순환합니다.");
  return errors;
}

/** Explicit bundles are selected as one unit; ordinary material links remain independent. */
export function selectedPiecesForRegistration(
  pieces: Piece[],
  ids: string[],
): Piece[] {
  const selected = new Set(ids);
  const visit = (id: string) => {
    const piece = pieces.find((p) => p.id === id);
    for (const dependency of [
      ...(bundleOwner(pieces, id)
        ? [
            bundleOwner(pieces, id)!.id,
            ...bundleOwner(pieces, id)!.bundleQuestionIds!,
          ]
        : []),
      ...(piece?.materialIds ?? []),
      ...(piece?.dependencyIds ?? []),
    ]) {
      if (!selected.has(dependency)) {
        selected.add(dependency);
        visit(dependency);
      }
    }
  };
  ids.forEach(visit);
  return pieces.filter((p) => selected.has(p.id));
}
