import type { PendingQuestion, Piece } from "./types";

export const questionLabel = (p: Piece) =>
  p.originalLabel?.replace(/[.번]\s*$/, "") || String(p.number ?? p.name);
export function bundleMembers(pieces: Piece[], passage: Piece) {
  return (passage.bundleQuestionIds ?? []).flatMap((id) => {
    const p = pieces.find((p) => p.id === id && p.kind === "question");
    return p ? [p] : [];
  });
}
export function bundleOwner(pieces: Piece[], id: string) {
  return pieces.find(
    (p) =>
      p.kind === "passage" &&
      p.bundleQuestionIds?.length &&
      (p.id === id || p.bundleQuestionIds.includes(id)),
  );
}
export function bundleRange(pieces: Piece[], passage: Piece) {
  const members = bundleMembers(pieces, passage);
  return members.length > 1
    ? `${questionLabel(members[0])}–${questionLabel(members.at(-1)!)}`
    : members[0]
      ? questionLabel(members[0])
      : "";
}
/** Apply once to fresh imports; later edits and ungrouping are user-owned. */
export function autoBundlePassages(pieces: Piece[]): Piece[] {
  const passages = pieces.filter((p) => p.kind === "passage");
  return pieces.map((passage) => {
    if (passage.kind !== "passage" || passage.bundleQuestionIds !== undefined)
      return passage;
    const members = pieces.filter(
      (p) => p.kind === "question" && p.materialIds?.includes(passage.id),
    );
    if (
      !members.length ||
      new Set(members.map((p) => p.sectionId ?? "")).size > 1 ||
      members.some(
        (p) =>
          (passage.sectionId && p.sectionId !== passage.sectionId) ||
          bundleOwner(pieces, p.id) ||
          passages.filter((candidate) => p.materialIds?.includes(candidate.id))
            .length !== 1,
      )
    )
      return passage;
    return {
      ...passage,
      bundleQuestionIds: members.map((p) => p.id),
      confirmed: false,
    };
  });
}

export function setPassageBundle(
  pieces: Piece[],
  passageId: string,
  startId: string,
  endId: string,
): Piece[] {
  const passage = pieces.find(
    (p) => p.id === passageId && p.kind === "passage",
  );
  if (!passage) throw new Error("묶을 지문을 찾을 수 없습니다.");
  const questions = pieces.filter((p) => p.kind === "question");
  const start = questions.findIndex((p) => p.id === startId),
    end = questions.findIndex((p) => p.id === endId);
  if (start < 0 || end < start)
    throw new Error("시작 문제와 끝 문제의 순서를 확인해주세요.");
  const chosen = questions.slice(start, end + 1);
  if (
    new Set(chosen.map((p) => p.sectionId ?? "")).size > 1 ||
    (passage.sectionId && chosen.some((p) => p.sectionId !== passage.sectionId))
  )
    throw new Error("같은 영역의 문제끼리 묶어주세요.");
  if (
    chosen.some((p) => {
      const owner = bundleOwner(pieces, p.id);
      return owner && owner.id !== passageId;
    })
  )
    throw new Error(
      "다른 지문 묶음에 포함된 문제입니다. 기존 묶기를 해제해주세요.",
    );
  const ids = chosen.map((p) => p.id);
  return pieces.map((p) =>
    p.id === passageId
      ? { ...p, bundleQuestionIds: ids, confirmed: false }
      : ids.includes(p.id)
        ? {
            ...p,
            materialIds: [...new Set([...(p.materialIds ?? []), passageId])],
            confirmed: false,
          }
        : passage.bundleQuestionIds?.includes(p.id)
          ? {
              ...p,
              materialIds: p.materialIds?.filter((id) => id !== passageId),
              confirmed: false,
            }
          : p,
  );
}
export function toggleBundleSelection(
  pieces: Piece[],
  ids: string[],
  id: string,
  checked: boolean,
) {
  const owner = bundleOwner(pieces, id),
    unit = owner ? [owner.id, ...owner.bundleQuestionIds!] : [id];
  return checked
    ? [...new Set([...ids, ...unit])]
    : ids.filter((id) => !unit.includes(id));
}
export function registrationUnitCount(pieces: Piece[]) {
  return pieces.filter(
    (p) =>
      (p.kind !== "passage" && !bundleOwner(pieces, p.id)) ||
      p.bundleQuestionIds?.length,
  ).length;
}

/** Compose each source piece first, then publish a single row with ordered fragments. */
export function bundleRegistrationRows(
  pieces: Piece[],
  rows: PendingQuestion[],
): PendingQuestion[] {
  const owners = pieces.filter(
    (p) => p.kind === "passage" && p.bundleQuestionIds?.length,
  );
  const mapped = new Map<string, string>();
  for (const owner of owners)
    for (const id of [owner.id, ...owner.bundleQuestionIds!])
      mapped.set(id, `${owner.id}:bundle`);
  const output: PendingQuestion[] = [];
  const emitted = new Set<string>();
  for (const row of rows) {
    const groupId = mapped.get(row.id);
    if (!groupId) {
      output.push(row);
      continue;
    }
    if (emitted.has(groupId)) continue;
    emitted.add(groupId);
    const owner = owners.find((p) => `${p.id}:bundle` === groupId)!;
    const memberIds = [owner.id, ...owner.bundleQuestionIds!];
    const ordered = memberIds.map((id) => {
      const r = rows.find((r) => r.id === id);
      if (!r) throw new Error("묶음에 포함된 지문이나 문제가 빠졌습니다.");
      return r;
    });
    const passage = ordered[0];
    const range = bundleRange(pieces, owner);
    output.push({
      ...passage,
      id: groupId,
      name: `${range}번 지문 묶음`,
      originalLabel: range,
      memo: `${passage.filename} · 지문 + ${ordered.length - 1}문제`,
      bundle: {
        passageId: owner.id,
        questionIds: [...owner.bundleQuestionIds!],
        labels: bundleMembers(pieces, owner).map(questionLabel),
      },
      source: passage.source
        ? {
            ...passage.source,
            kind: "question",
            group: groupId,
            pages: [...new Set(ordered.flatMap((r) => r.source?.pages ?? []))],
          }
        : undefined,
      fragments: ordered.flatMap((r) => r.fragments ?? []),
      extraAssets: ordered.flatMap((r) => r.extraAssets ?? []),
      materialIds: [
        ...new Set(ordered.flatMap((r) => r.materialIds ?? [])),
      ].filter((id) => !memberIds.includes(id)),
      dependencyIds: [
        ...new Set(ordered.flatMap((r) => r.dependencyIds ?? [])),
      ].filter((id) => !memberIds.includes(id)),
    });
  }
  return output.map((row) => ({
    ...row,
    dependencyIds: [
      ...new Set((row.dependencyIds ?? []).map((id) => mapped.get(id) ?? id)),
    ].filter((id) => id !== row.id),
  }));
}
