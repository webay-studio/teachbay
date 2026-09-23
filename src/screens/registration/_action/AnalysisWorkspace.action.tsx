"use client";
import { useState } from "react";
import { FileText, Check } from "lucide-react";
import { useBlobUrl } from "@ui/shared";
import { useRegistrationHandler } from "../_handler/Registration.handler";
import type { ImportJob } from "../_model/registration.model";
import {
  registrationProgressMessage,
  registrationProgressDetail,
} from "../_lib/registrationHelpers.lib";

function AnalysisFile({ job }: { job: ImportJob }) {
  const [selectedPage, setSelectedPage] = useState<number>();
  const latest = job.previews.at(-1);
  const shown = job.previews.find((p) => p.index === selectedPage) ?? latest;
  const url = useBlobUrl(shown?.asset.blob);
  const total = job.progress?.total ?? 0;
  const completed = job.progress?.current ?? 0;
  const current = Math.min(completed + 1, total);
  const finishing = total > 0 && completed >= total;
  return (
    <section
      className="analysis-workspace"
      aria-label="문서 분석 현황"
      aria-busy="true"
    >
      <header className="review-workspace-heading">
        <div>
          <span>문제 분석</span>
          <strong title={job.name}>{job.name}</strong>
        </div>
        <span>{total > 0 ? `전체 ${total}쪽` : "파일 확인 중"}</span>
      </header>
      <div className="analysis-layout">
        <aside className="analysis-source">
          <h3>원본 {shown ? `· ${shown.index + 1}쪽` : "문서"}</h3>
          {url ? (
            <img src={url} alt={`${shown!.index + 1}쪽 분석 원본`} />
          ) : (
            <div className="analysis-source-empty">
              <FileText size={32} strokeWidth={1} />
              <span>원본을 여는 중</span>
            </div>
          )}
          <p>분석 중에도 원본을 확인할 수 있어요.</p>
        </aside>
        <div className="analysis-status" role="status" aria-live="polite">
          <div className="analysis-paper-motion" aria-hidden="true">
            <span />
            <span />
            <div>
              <i />
              <i />
              <i />
              <b />
            </div>
          </div>
          <span className="analysis-eyebrow">
            {finishing ? "마지막 정리" : "문제를 찾고 있어요"}
          </span>
          <strong
            key={`${current}-${finishing}`}
            className="analysis-page-number"
          >
            {finishing ? (
              "문제를 정리하고 있어요"
            ) : current > 0 ? (
              <>
                {current}
                <small> / {total}쪽</small>
              </>
            ) : (
              "문서 준비 중"
            )}
          </strong>
          <p className="analysis-stage-message">
            {registrationProgressMessage(job.progress)}
          </p>
          <div
            className="analysis-progress-track"
            role="progressbar"
            aria-label="분석 완료 페이지"
            aria-valuenow={completed}
            aria-valuemin={0}
            aria-valuemax={total || 1}
            aria-valuetext={`${completed} / ${total || "–"}쪽 완료`}
          >
            {Array.from({ length: total || 1 }, (_, index) => (
              <span
                key={index}
                data-state={
                  index < completed
                    ? "done"
                    : index + 1 === current
                      ? "current"
                      : "waiting"
                }
              />
            ))}
          </div>
          <span className="analysis-detail">
            {registrationProgressDetail(job.progress)}
          </span>
        </div>
        <aside className="analysis-pages">
          <h3>페이지 진행</h3>
          <span className="analysis-page-count">
            {completed} / {total || "–"}쪽 완료
          </span>
          <div className="analysis-page-list">
            {Array.from({ length: total }, (_, index) => {
              const ready = job.previews.some((p) => p.index === index);
              const done = index < completed;
              return (
                <button
                  key={index}
                  disabled={!ready}
                  aria-pressed={shown?.index === index}
                  data-state={
                    done
                      ? "done"
                      : index + 1 === current
                        ? "current"
                        : "waiting"
                  }
                  onClick={() => setSelectedPage(index)}
                >
                  <span>{index + 1}쪽</span>
                  {done ? (
                    <>
                      <span>완료</span>
                      <Check size={14} />
                    </>
                  ) : index + 1 === current ? (
                    <>
                      <span>분석 중</span>
                      <span className="analysis-activity" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                    </>
                  ) : (
                    <span>대기</span>
                  )}
                </button>
              );
            })}
          </div>
          {selectedPage !== undefined && (
            <button
              className="text-btn"
              onClick={() => setSelectedPage(undefined)}
            >
              분석 중인 쪽 보기
            </button>
          )}
        </aside>
      </div>
    </section>
  );
}

export function AnalysisWorkspaceAction() {
  const { jobs, reading, reviewId } = useRegistrationHandler();
  const job = jobs.find((job) => job.state === "processing");
  return reading && !reviewId && job ? (
    <AnalysisFile key={job.id} job={job} />
  ) : null;
}
