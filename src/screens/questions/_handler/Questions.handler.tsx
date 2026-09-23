"use client";
import { createContext, useContext, type ReactNode } from "react";
import { useCallback, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useRegistrationIntake } from "@/_state/RegistrationIntake";
import { errorText } from "@engine/db";
import type { Question } from "@engine/types";
import { useQuestionsState } from "../_state/useQuestionsStore";
import {
  loadQuestions,
  addQuestionsToDraft,
  updateQuestion,
  deleteQuestion,
} from "../_lib/questions.lib";
import { filterQuestions, selectVisible } from "../_lib/questionsHelpers.lib";
function useQuestionsController() {
  const state = useQuestionsState();
  const {
    rows,
    query,
    selected,
    edit,
    setRows,
    setLoading,
    setError,
    setBusy,
    setSelected,
    setMenu,
    setEdit,
  } = state;
  const router = useRouter();
  const intake = useRegistrationIntake();
  const pathname = usePathname();
  const pending = useRef(false);
  const refresh = useCallback(async () => {
    try {
      setRows(await loadQuestions());
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [setRows, setError, setLoading]);
  useEffect(() => {
    if (pathname === "/questions") void refresh();
  }, [refresh, pathname]);
  const filtered = filterQuestions(rows, query);
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
  const make = () =>
    run(async () => {
      await addQuestionsToDraft(rows, selected);
      router.push("/exams/new");
    });
  const saveEdit = () =>
    run(async () => {
      if (!edit?.name.trim()) return;
      await updateQuestion(edit);
      setEdit(undefined);
      await refresh();
    });
  const removeQuestion = (id: string) => {
    if (!confirm("이 문제를 삭제할까요? 저장한 시험지는 그대로 유지됩니다."))
      return;
    return run(async () => {
      await deleteQuestion(id);
      setSelected((prev) => prev.filter((value) => value !== id));
      setMenu(undefined);
      await refresh();
    });
  };
  function toggleQuestion(id: string, checked: boolean) {
    setSelected((prev) =>
      checked
        ? Array.from(new Set([...prev, id]))
        : prev.filter((value) => value !== id),
    );
  }
  function toggleVisible(checked: boolean) {
    setSelected((prev) => selectVisible(prev, filtered, checked));
  }
  function openEdit(question: Question) {
    setEdit({ ...question });
    setMenu(undefined);
  }
  function registerFiles(files: File[]) {
    if (!files.length) return;
    intake.stage(files);
    router.push("/questions/new", { scroll: false });
  }
  return {
    ...state,
    filtered,
    make,
    saveEdit,
    removeQuestion,
    toggleQuestion,
    toggleVisible,
    openEdit,
    registerFiles,
  };
}

const Context = createContext<ReturnType<typeof useQuestionsController> | null>(
  null,
);
export function QuestionsHandler({ children }: { children: ReactNode }) {
  const controller = useQuestionsController();
  return <Context.Provider value={controller}>{children}</Context.Provider>;
}
export function useQuestionsHandler() {
  const context = useContext(Context);
  if (!context) throw new Error("QuestionsHandler is missing.");
  return context;
}
