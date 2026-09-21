import type { Question } from "@engine/types";
export function filterQuestions(rows: Question[], query: string) {
  const term = query.toLowerCase();
  return rows.filter((q) =>
    [q.name, q.filename, q.memo].join(" ").toLowerCase().includes(term),
  );
}
export function selectVisible(
  selected: string[],
  visible: Question[],
  checked: boolean,
) {
  const ids = new Set(visible.map((q) => q.id));
  return checked
    ? Array.from(new Set([...selected, ...ids]))
    : selected.filter((id) => !ids.has(id));
}
