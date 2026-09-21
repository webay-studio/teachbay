"use client";
import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, Copy, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Shell, Heading } from "../../../components/shared";
import { ExamRenderer, useLayout } from "../../../components/exam-renderer";
import { get, put, errorText } from "../../../lib/db";
import { Exam } from "../../../lib/types";
import { printExam } from "../../../lib/print";
export default function ExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [exam, setExam] = useState<Exam>(),
    [error, setError] = useState("");
  useEffect(() => {
    get("exams", id)
      .then((e) => (e ? setExam(e) : setError("시험지를 찾을 수 없어요.")))
      .catch((e) => setError(errorText(e)));
  }, [id]);
  return (
    <Shell>
      {exam ? (
        <Detail exam={exam} />
      ) : (
        <div className="empty">
          <h2>{error || "시험지를 불러오는 중…"}</h2>
          <Link href="/exams" className="btn">
            만든 시험지로
          </Link>
        </div>
      )}
    </Shell>
  );
}
function Detail({ exam }: { exam: Exam }) {
  const {
    assets,
    pages,
    loading,
    error: layoutError,
  } = useLayout(exam.items, exam.settings);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
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
    if (loading || layoutError || !pages.length || attempted.current) return;
    if (new URLSearchParams(location.search).get("print") === "1") {
      attempted.current = true;
      requestAnimationFrame(() => {
        void print();
      });
    }
  }, [loading, layoutError, pages.length]);
  return (
    <>
      <Link href="/exams" className="back-link no-print">
        <ArrowLeft size={15} />
        만든 시험지
      </Link>
      <Heading
        eyebrow="SAVED WORKSHEET"
        title={exam.title}
        description={`${new Date(exam.createdAt).toLocaleDateString("ko-KR")} 저장 · ${exam.items.length}문항 · ${pages.length}페이지`}
      >
        <div className="actions">
          <button
            className="btn"
            onClick={async () => {
              if (
                !confirm(
                  "현재 작성 중인 내용을 복사본으로 바꿀까요? 저장된 원본은 유지됩니다.",
                )
              )
                return;
              try {
                await put("drafts", {
                  id: "current",
                  title: `${exam.title} (복사본)`,
                  items: structuredClone(exam.items),
                  settings: { ...exam.settings },
                });
                router.push("/exams/new");
              } catch (e) {
                setError(errorText(e));
              }
            }}
          >
            <Copy size={16} />
            복사해서 수정
          </button>
          <button
            disabled={loading || busy || !!layoutError || !pages.length}
            className="btn primary"
            onClick={print}
          >
            <Printer size={17} />
            {busy ? "출력 준비 중…" : "다시 출력"}
          </button>
        </div>
      </Heading>
      {(error || layoutError) && (
        <p className="error no-print" role="alert">
          {error || layoutError}
        </p>
      )}
      {status && (
        <p className="notice no-print" role="status">
          {status}
        </p>
      )}
      <div className="saved-preview">
        {loading ? (
          <div className="empty">이미지를 불러오는 중…</div>
        ) : (
          <ExamRenderer
            title={exam.title}
            settings={exam.settings}
            assets={assets}
            pages={pages}
            date={exam.createdAt}
          />
        )}
      </div>
    </>
  );
}
