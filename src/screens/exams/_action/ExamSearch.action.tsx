"use client";
import { Search } from "lucide-react";
import { useExamsHandler } from "../_handler/Exams.handler";
export function ExamSearchAction() {
  const { rows, error, query, setQuery } = useExamsHandler();
  return (
    <>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="library-toolbar">
        <div className="tabs">
          <span>
            전체 시험지 <b>{rows.length}</b>
          </span>
        </div>
        <label className="search">
          <Search size={17} />
          <input
            placeholder="시험지 제목 검색"
            aria-label="시험지 제목 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <span className="sort">최근 생성순</span>
      </div>
    </>
  );
}
