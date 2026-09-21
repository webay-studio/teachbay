"use client";
import { ExamRenderer } from "@ui/exam-renderer";
import { useExamDetailHandler } from "../_handler/ExamDetail.handler";
export function SavedPreviewAction() {
  const { exam, pages, assets, loading, error, layoutError, status } =
    useExamDetailHandler();
  return (
    <>
      {" "}
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
