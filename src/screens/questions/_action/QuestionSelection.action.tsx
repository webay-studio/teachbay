"use client";
import { ArrowRight } from "lucide-react";
import { useQuestionsHandler } from "../_handler/Questions.handler";
export function QuestionSelectionAction() {
  const { selected, setSelected, busy, make } = useQuestionsHandler();
  return (
    <>
      {" "}
      {selected.length > 0 && (
        <div className="selection-bar">
          <span className="selection-count">{selected.length}</span>
          <strong>선택한 문제 {selected.length}개</strong>
          <button className="text-btn" onClick={() => setSelected([])}>
            선택 해제
          </button>
          <button className="btn primary" disabled={busy} onClick={make}>
            시험지 만들기
            <ArrowRight size={17} />
          </button>
        </div>
      )}
    </>
  );
}
