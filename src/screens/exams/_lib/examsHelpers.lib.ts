import type { Exam, ExamDraft } from "@engine/types";
export function filterExams(rows: Exam[], query: string) {
  return rows.filter((exam) =>
    exam.title.toLowerCase().includes(query.toLowerCase()),
  );
}
export function copyExamDraft(exam: Exam): ExamDraft {
  return {
    id: "current",
    title: `${exam.title} (복사본)`,
    items: structuredClone(exam.items),
    settings: { ...exam.settings },
  };
}
