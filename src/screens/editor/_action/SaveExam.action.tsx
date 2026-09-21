"use client";
import { Printer, Save } from "lucide-react";
import { useEditorHandler } from "../_handler/Editor.handler";
export function SaveExamAction() {
  const { busy, loading, layoutError, pages, save } = useEditorHandler();
  return (
    <>
      {" "}
      <div className="actions">
        <button
          className="btn"
          disabled={busy || loading || !!layoutError || !pages.length}
          onClick={() => save(pages.length, false)}
        >
          <Save size={17} />
          저장
        </button>
        <button
          className="btn primary"
          disabled={busy || loading || !!layoutError || !pages.length}
          onClick={() => save(pages.length, true)}
        >
          <Printer size={17} />
          {busy ? "준비하는 중…" : "저장하고 출력"}
        </button>
      </div>
    </>
  );
}
