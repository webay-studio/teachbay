"use client";
import { Search, SlidersHorizontal } from "lucide-react";
import { useQuestionsHandler } from "../_handler/Questions.handler";
export function QuestionSearchAction() {
  const { rows, error, query, setQuery } = useQuestionsHandler();
  return (
    <>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="library-toolbar">
        <div className="tabs">
          <span>
            전체 문제 <b>{rows.length}</b>
          </span>
        </div>
        <div className="toolbar-right">
          <label className="search">
            <Search size={18} />
            <input
              aria-label="문제 검색"
              placeholder="문제 이름, 파일명, 메모 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <span className="sort">
            <SlidersHorizontal size={15} />
            최근 등록순
          </span>
        </div>
      </div>
    </>
  );
}
