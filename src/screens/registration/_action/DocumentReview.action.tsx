"use client";
import { X } from "lucide-react";
import { DocumentReview } from "@ui/documents/document-review";
import { useRegistrationHandler } from "../_handler/Registration.handler";
export function DocumentReviewAction() {
  const {
    documents,
    reviewId,
    setReviewId,
    busy,
    removeDocument,
    updateReview,
    setBusy,
    acceptReview,
  } = useRegistrationHandler();
  return (
    <>
      {" "}
      {documents.length > 0 && (
        <div className="registration-file-list" aria-label="검토할 파일 목록">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className={`registration-file-row ${reviewId === doc.id ? "active" : ""}`}
            >
              <button
                className="file-review-open"
                disabled={busy}
                aria-pressed={reviewId === doc.id}
                onClick={() => setReviewId(doc.id)}
              >
                <strong>{doc.filename}</strong>
                <span>
                  {doc.pages.length}쪽 · {doc.pieces.length}개 영역
                </span>
                <b>{reviewId === doc.id ? "검토 중" : "검토"}</b>
              </button>
              <button
                className="icon"
                disabled={busy}
                aria-label={`${doc.filename} 등록에서 제외`}
                onClick={() => removeDocument(doc.id)}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
      {reviewId && documents.find((doc) => doc.id === reviewId) && (
        <DocumentReview
          key={reviewId}
          document={documents.find((doc) => doc.id === reviewId)!}
          onDraftChange={updateReview}
          onBusyChange={setBusy}
          onAccept={acceptReview}
        />
      )}
    </>
  );
}
