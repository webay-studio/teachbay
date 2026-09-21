import { all, get, put, remove } from "@engine/db";
import type { Exam } from "@engine/types";
import { copyExamDraft } from "./examsHelpers.lib";
export async function loadExams() {
  return (await all("exams")).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}
export function loadExam(id: string) {
  return get("exams", id);
}
export async function copyExam(exam: Exam) {
  await put("drafts", copyExamDraft(exam));
}
export async function deleteExam(id: string) {
  await remove("exams", id);
}
