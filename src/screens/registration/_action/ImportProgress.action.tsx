"use client";
import { FileText, CheckCircle2, X, Loader2 } from "lucide-react";
import { useRegistrationHandler } from "../_handler/Registration.handler";
function Skeleton() {
  return (
    <div className="scan-skeleton" aria-hidden="true">
      <i />
      <i />
      <i />
      <div />
      <i />
      <i />
    </div>
  );
}
export function ImportProgressAction() {
  const {
    jobs,
    documents,
    errors,
    setErrors,
    reading,
    cancel,
    reviewId,
    setReviewId,
    busy,
    removeDocument,
  } = useRegistrationHandler();
  if (!jobs.length && !errors.length) return null;
  const pending = jobs.filter(
    (j) => j.state === "waiting" || j.state === "processing",
  ).length;
  return (
    <section className="scan-dashboard" aria-label="파일 분석 진행 목록">
      <div className="scan-dashboard-heading">
        <div>
          <strong>{reading ? "파일을 분석하고 있어요" : "분석 결과"}</strong>
          <span>
            {pending
              ? `${pending}개 처리 중 · 완료된 파일부터 검토할 수 있어요`
              : "필요한 문제를 확인하고 저장하세요"}
          </span>
        </div>
        {reading > 0 && (
          <button className="text-btn" onClick={() => cancel.current?.abort()}>
            분석 중단
          </button>
        )}
      </div>
      <div className="scan-job-grid compact">
        {jobs.map((job) => {
          const doc = documents.find((d) => d.id === job.documentId);
          const running = job.state === "processing",
            waiting = job.state === "waiting";
          return (
            <article
              key={job.id}
              className={`scan-job ${doc && reviewId === doc.id ? "active" : ""}`}
              aria-label={`${job.name} 분석 상태`}
              aria-busy={running || waiting}
            >
              <header>
                <FileText size={18} />
                <strong title={job.name}>{job.name}</strong>
                {running ? (
                  <Loader2 className="spin" size={16} />
                ) : ["ready", "saved"].includes(job.state) ? (
                  <CheckCircle2 size={16} />
                ) : null}
                {doc && (
                  <button
                    className="icon"
                    disabled={busy}
                    aria-label={`${job.name} 등록에서 제외`}
                    onClick={() => removeDocument(doc.id)}
                  >
                    <X size={14} />
                  </button>
                )}
              </header>
              <p className="scan-job-status" role="status">
                {running
                  ? (job.progress?.message ?? "파일 확인 중…")
                  : waiting
                    ? "차례를 기다리고 있어요"
                    : job.state === "cancelled"
                      ? "분석 중단 · 파일을 다시 선택할 수 있어요"
                      : job.state === "error"
                        ? job.error
                        : job.state === "saved"
                          ? "저장했어요"
                          : doc
                            ? `${doc.pages.length}쪽 · ${doc.pieces.length}개 영역 · 검토 가능`
                            : "이미지 준비 완료"}
              </p>
              {running && (
                <progress
                  aria-label={`${job.name} 완료한 페이지`}
                  max={job.progress?.total || 1}
                  value={job.progress?.current || 0}
                />
              )}
              {doc && (
                <button
                  className="btn scan-review-button"
                  disabled={busy}
                  onClick={() =>
                    setReviewId(reviewId === doc.id ? undefined : doc.id)
                  }
                >
                  {reviewId === doc.id ? "미리보기 목록으로" : "문제 검토"}
                </button>
              )}
            </article>
          );
        })}
      </div>
      {!!reading && !reviewId && (
        <div
          className="registration-skeleton-workspace"
          aria-label="시험지 분석 중"
          aria-busy="true"
        >
          <aside>
            <div className="skeleton-page">
              <Skeleton />
              <Skeleton />
            </div>
          </aside>
          <main>
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </main>
          <aside className="skeleton-options">
            <Skeleton />
            <Skeleton />
          </aside>
        </div>
      )}
      {!!errors.length && (
        <details className="scan-errors">
          <summary>확인할 오류 {errors.length}개</summary>
          {errors.map((e, i) => (
            <p key={i}>{e}</p>
          ))}
          <button className="text-btn" onClick={() => setErrors([])}>
            알림 닫기
          </button>
        </details>
      )}
    </section>
  );
}
