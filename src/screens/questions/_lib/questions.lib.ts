import { all, put, remove, draft } from "@engine/db";
import { snapshotQuestion } from "@engine/reuse";
import type { Question } from "@engine/types";
export async function loadQuestions() {
  return (await all("questions")).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}
export async function addQuestionsToDraft(
  rows: Question[],
  selected: string[],
) {
  const value = await draft();
  const ids = new Set(value.items.map((q) => q.id));
  const documents = await all("documents");
  value.items.push(
    ...rows
      .filter((q) => selected.includes(q.id) && !ids.has(q.id))
      .map((q) => snapshotQuestion(q, documents, rows)),
  );
  await put("drafts", value);
}
export async function updateQuestion(question: Question) {
  await put("questions", { ...question, updatedAt: new Date().toISOString() });
}
export async function deleteQuestion(id: string) {
  await remove("questions", id);
}
