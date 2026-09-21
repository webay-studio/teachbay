"use client";
import { createContext, useContext, type ReactNode } from "react";
import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Exam } from "@engine/types";
import { errorText } from "@engine/db";
import { useExamsState } from "../_state/useExamsStore";
import { loadExams, copyExam, deleteExam } from "../_lib/exams.lib";
import { filterExams } from "../_lib/examsHelpers.lib";
function useExamsController() {
  const state = useExamsState();
  const { rows, query, setRows, setError, setLoading, setBusy } = state;
  const router = useRouter();
  const pending = useRef(false);
  const refresh = useCallback(async () => {
    try {
      setRows(await loadExams());
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [setRows, setError, setLoading]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  async function run(work: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(errorText(e));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  function handleCopy(exam: Exam) {
    if (
      !confirm(
        "현재 작성 중인 내용을 이 시험지의 복사본으로 바꿀까요? 원본 시험지는 유지됩니다.",
      )
    )
      return;
    return run(async () => {
      await copyExam(exam);
      router.push("/exams/new");
    });
  }
  function handleDelete(id: string) {
    if (!confirm("저장한 시험지를 삭제할까요? 내 문제는 유지됩니다.")) return;
    return run(async () => {
      await deleteExam(id);
      await refresh();
    });
  }
  return {
    ...state,
    filtered: filterExams(rows, query),
    handleCopy,
    handleDelete,
  };
}

const Context = createContext<ReturnType<typeof useExamsController> | null>(
  null,
);
export function ExamsHandler({ children }: { children: ReactNode }) {
  const controller = useExamsController();
  return <Context.Provider value={controller}>{children}</Context.Provider>;
}
export function useExamsHandler() {
  const context = useContext(Context);
  if (!context) throw new Error("ExamsHandler is missing.");
  return context;
}
