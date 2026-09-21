import type { ExamDraft } from "@engine/types";
export function draftSignature(value: ExamDraft) {
  return JSON.stringify({
    title: value.title,
    items: value.items,
    settings: value.settings,
  });
}
export function moveDraftItem(
  value: ExamDraft,
  from: number,
  to: number,
): ExamDraft {
  if (
    from < 0 ||
    from >= value.items.length ||
    to < 0 ||
    to >= value.items.length
  )
    return value;
  const items = [...value.items];
  const [item] = items.splice(from, 1);
  items.splice(to, 0, item);
  return { ...value, items };
}
