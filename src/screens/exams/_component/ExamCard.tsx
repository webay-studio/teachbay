"use client";
import Link from "next/link";
import { Printer, Copy, Trash2, FileText, ArrowUpRight } from "lucide-react";
import { AssetImage } from "@ui/shared";
import type { Exam } from "@engine/types";
import { useExamsHandler } from "../_handler/Exams.handler";
export function ExamCard({ exam }: { exam: Exam }) {
  const { busy, handleCopy, handleDelete } = useExamsHandler();
  return (
    <article className="exam-card">
      <Link
        href={`/exams/${exam.id}`}
        className="exam-thumbnail"
        aria-label={`${exam.title} 미리보기`}
      >
        <div className="mini-paper">
          <h3>{exam.title}</h3>
          <div className="mini-line" />
          <div
            className="mini-images"
            style={{
              gridTemplateColumns: `repeat(${exam.settings.columns},1fr)`,
            }}
          >
            {exam.items.slice(0, 6).map((i) => (
              <AssetImage key={i.id} id={i.assetId} alt={i.name} />
            ))}
          </div>
        </div>
        <span className="thumbnail-label">
          <FileText size={13} />
          {exam.pages}페이지
        </span>
      </Link>
      <div className="exam-info">
        <Link href={`/exams/${exam.id}`}>
          <h2>
            {exam.title}
            <ArrowUpRight size={16} />
          </h2>
        </Link>
        <p>
          {new Date(exam.createdAt).toLocaleDateString("ko-KR")}
          <i /> {exam.items.length}문항 · {exam.pages}페이지
        </p>
        <div className="exam-actions">
          <Link className="btn" href={`/exams/${exam.id}?print=1`}>
            <Printer size={15} />
            다시 출력
          </Link>
          <button
            className="text-btn"
            disabled={busy}
            onClick={() => handleCopy(exam)}
          >
            <Copy size={14} />
            복사해서 수정
          </button>
          <button
            className="icon"
            aria-label={`${exam.title} 삭제`}
            disabled={busy}
            onClick={() => handleDelete(exam.id)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}
