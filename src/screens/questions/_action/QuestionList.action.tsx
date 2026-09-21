"use client";
import { Search, Check } from "lucide-react";
import { Empty } from "@ui/shared";
import { QuestionCard } from "../_component/QuestionCard";
import { useQuestionsHandler } from "../_handler/Questions.handler";
export function QuestionListAction() {
  const { loading, rows, filtered, setQuery, selected, toggleVisible } =
    useQuestionsHandler();
  return (
    <>
      {" "}
      {loading ? (
        <div className="empty">문제를 불러오는 중…</div>
      ) : rows.length === 0 ? (
        <Empty
          title="첫 번째 문제부터, 가볍게."
          description="이미지, PDF, 한글 문서를 올려보세요. 나만의 문제 모음이 시작됩니다."
          href="/questions/new"
          label="문제 등록"
        />
      ) : filtered.length === 0 ? (
        <div className="empty">
          <Search size={28} />
          <h2>검색 결과가 없어요.</h2>
          <p>다른 문제 이름, 원본 파일명 또는 메모로 찾아보세요.</p>
          <button className="btn" onClick={() => setQuery("")}>
            검색 초기화
          </button>
        </div>
      ) : (
        <>
          <div className="list-summary">
            <label>
              <input
                type="checkbox"
                checked={
                  filtered.length > 0 &&
                  filtered.every((q) => selected.includes(q.id))
                }
                onChange={(e) => toggleVisible(e.target.checked)}
              />
              현재 목록 전체 선택
            </label>
            <span>이미지를 누르면 크게 볼 수 있어요</span>
          </div>
          <div className="question-grid grid grid-cols-3 gap-[22px] max-[1100px]:grid-cols-2 max-[560px]:gap-3 min-[1600px]:grid-cols-4">
            {filtered.map((q) => (
              <QuestionCard key={q.id} q={q} />
            ))}
          </div>
          <div className="library-hint">
            <Check size={15} />
            문제를 선택하면 나만의 시험지를 만들 수 있어요.
          </div>
        </>
      )}
    </>
  );
}
