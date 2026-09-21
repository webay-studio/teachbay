import type { Exam } from "@engine/types";
export interface ExamDetailState {
  exam?: Exam;
  error: string;
  busy: boolean;
  status: string;
  setExam: (exam?: Exam) => void;
  setError: (error: string) => void;
  setBusy: (busy: boolean) => void;
  setStatus: (status: string) => void;
}
