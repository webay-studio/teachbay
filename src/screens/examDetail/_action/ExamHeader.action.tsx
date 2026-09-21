"use client";
import Link from "next/link";
import { Printer, Copy, ArrowLeft } from "lucide-react";
import { Heading } from "@ui/shared";
import { useExamDetailHandler } from "../_handler/ExamDetail.handler";
export function ExamHeaderAction() {
  const { exam, pages, loading, busy, layoutError, print, handleCopy } =
    useExamDetailHandler();
  return (
    <>
      {" "}
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
          <button className="btn" onClick={handleCopy}>
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
    </>
  );
}
