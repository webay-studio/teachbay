"use client";
import { Empty } from "@ui/shared";
import { ExamCard } from "../_component/ExamCard";
import { useExamsHandler } from "../_handler/Exams.handler";
export function ExamListAction() {
  const { loading, rows, filtered, setQuery } = useExamsHandler();
  return (
    <>
      {" "}
      {loading ? (
        <div className="empty">시험지를 불러오는 중…</div>
      ) : rows.length === 0 ? (
        <Empty
          title="아직 만든 시험지가 없어요"
          description="내 문제를 골라 첫 시험지를 만들어보세요."
          href="/exams/new"
          label="시험지 만들기"
        />
      ) : filtered.length === 0 ? (
        <div className="empty">
          <h2>검색 결과가 없어요.</h2>
          <button className="btn" onClick={() => setQuery("")}>
            검색 초기화
          </button>
        </div>
      ) : (
        <div className="exam-grid">
          {filtered.map((exam) => (
            <ExamCard key={exam.id} exam={exam} />
          ))}
        </div>
      )}
    </>
  );
}
