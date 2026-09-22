"use client";
import { DocumentReview } from "@ui/documents/document-review";
import { useRegistrationHandler } from "../_handler/Registration.handler";
export function DocumentReviewAction() {
  const { documents, reviewId, updateReview, setBusy, acceptReview } =
    useRegistrationHandler();
  return (
    <>
      {" "}
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
