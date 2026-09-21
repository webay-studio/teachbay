"use client";
import {
  useEffect,
  useRef,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Exam } from "@engine/types";
import { errorText } from "@engine/db";
import { useLayout } from "@ui/exam-renderer";
import { loadExam, copyExam, printExam } from "../_lib/examDetail.lib";
import { wantsAutomaticPrint } from "../_lib/examDetailHelpers.lib";
import { useExamDetailState } from "../_state/useExamDetailStore";
function useDetailController(exam: Exam) {
  const {
    assets,
    pages,
    loading,
    error: layoutError,
  } = useLayout(exam.items, exam.settings);
  const state = useExamDetailState();
  const { setBusy, setError, setStatus } = state;
  const attempted = useRef(false);
  const router = useRouter();
  async function print() {
    setBusy(true);
    try {
      await printExam();
      setStatus(
        "출력 창을 요청했습니다. 인쇄 또는 PDF 저장 여부는 브라우저에서 확인해주세요.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "출력을 준비하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (
      loading ||
      layoutError ||
      !pages.length ||
      attempted.current ||
      !wantsAutomaticPrint(location.search)
    )
      return;
    const frame = requestAnimationFrame(() => {
      attempted.current = true;
      void print();
    });
    return () => cancelAnimationFrame(frame);
  }, [loading, layoutError, pages.length]);
  async function handleCopy() {
    if (
      !confirm(
        "현재 작성 중인 내용을 복사본으로 바꿀까요? 저장된 원본은 유지됩니다.",
      )
    )
      return;
    try {
      await copyExam(exam);
      router.push("/exams/new");
    } catch (e) {
      setError(errorText(e));
    }
  }
  return {
    ...state,
    exam,
    assets,
    pages,
    loading,
    layoutError,
    print,
    handleCopy,
  };
}
const Context = createContext<ReturnType<typeof useDetailController> | null>(
  null,
);
function LoadedDetail({ exam, children }: { exam: Exam; children: ReactNode }) {
  const controller = useDetailController(exam);
  return <Context.Provider value={controller}>{children}</Context.Provider>;
}
export function ExamDetailHandler({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const { exam, error, setExam, setError } = useExamDetailState();
  useEffect(() => {
    let live = true;
    setExam(undefined);
    setError("");
    loadExam(id)
      .then((value) => {
        if (!live) return;
        if (value) setExam(value);
        else setError("시험지를 찾을 수 없어요.");
      })
      .catch((e) => {
        if (live) setError(errorText(e));
      });
    return () => {
      live = false;
    };
  }, [id, setExam, setError]);
  if (!exam)
    return (
      <div className="empty">
        <h2>{error || "시험지를 불러오는 중…"}</h2>
        <Link href="/exams" className="btn">
          만든 시험지로
        </Link>
      </div>
    );
  return (
    <LoadedDetail key={exam.id} exam={exam}>
      {children}
    </LoadedDetail>
  );
}
export function useExamDetailHandler() {
  const context = useContext(Context);
  if (!context) throw new Error("ExamDetailHandler is missing.");
  return context;
}
