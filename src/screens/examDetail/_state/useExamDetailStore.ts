"use client";
import { useShallow } from "zustand/react/shallow";
import { createScreenStore } from "@/_state/createScreenStore";
import type { ExamDetailState } from "../_model/examDetail.model";
const { Provider, useScreenStore } = createScreenStore<ExamDetailState>(
  (set) => ({
    exam: undefined,
    error: "",
    busy: false,
    status: "",
    setExam: (exam) => set({ exam }),
    setError: (error) => set({ error }),
    setBusy: (busy) => set({ busy }),
    setStatus: (status) => set({ status }),
  }),
);
export {
  Provider as ExamDetailStoreProvider,
  useScreenStore as useExamDetailStore,
};
export function useExamDetailState() {
  return useScreenStore(useShallow((state) => ({ ...state })));
}
