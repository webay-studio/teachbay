"use client";
import { Search, Check, Plus } from "lucide-react";
import Link from "next/link";
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
        <section
          className="library-start"
          aria-labelledby="library-start-title"
        >
          <div className="library-paper" aria-hidden="true">
            <div className="library-paper-top">나의 문제 모음</div>
            <div className="library-paper-rule" />
            <div className="library-paper-question">
              <b>01</b>
              <span />
            </div>
            <div className="library-paper-lines">
              <i />
              <i />
              <i />
            </div>
            <div className="library-paper-question">
              <b>02</b>
              <span />
            </div>
            <div className="library-paper-lines">
              <i />
              <i />
            </div>
            <div className="library-paper-foot">TEACHBAY</div>
          </div>
          <div className="library-start-copy">
            <span className="library-start-label">내 문제 보관함</span>
            <h2 id="library-start-title">아직 등록한 문제가 없어요.</h2>
            <p>
              가지고 있는 시험지에서 문제를 모아보세요.
              <br />
              필요한 문제를 골라 새 시험지로 만들 수 있어요.
            </p>
            <Link href="/questions/new" scroll={false} className="btn primary">
              <Plus size={17} /> 첫 문제 등록하기
            </Link>
            <small>이미지 · PDF · 한글 파일</small>
          </div>
        </section>
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
