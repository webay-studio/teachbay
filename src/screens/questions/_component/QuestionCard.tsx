"use client";
import { Ellipsis, Expand, Link2 } from "lucide-react";
import { AssetImage } from "@ui/shared";
import type { Question } from "@engine/types";
import { useQuestionsHandler } from "../_handler/Questions.handler";
export function QuestionCard({ q }: { q: Question }) {
  const {
    selected,
    setZoom,
    menu,
    setMenu,
    toggleQuestion,
    openEdit,
    removeQuestion,
  } = useQuestionsHandler();
  const bundleRange = q.bundle?.labels.length
    ? q.bundle.labels.length > 1
      ? `${q.bundle.labels[0]}–${q.bundle.labels.at(-1)}번`
      : `${q.bundle.labels[0]}번`
    : "";
  return (
    <article
      className={`question-card ${selected.includes(q.id) ? "selected" : ""}`}
    >
      <div className="card-image">
        <button
          className="image-open"
          aria-label={`${q.name} 이미지 확대`}
          onClick={() => setZoom(q)}
        >
          <AssetImage id={q.assetId} alt={q.name} />
          {q.bundle && (
            <span className="question-bundle-badge">
              <Link2 size={13} />
              지문 묶음{bundleRange && ` · ${bundleRange}`}
            </span>
          )}
          <span className="expand">
            <Expand size={16} />
          </span>
        </button>
        <input
          className="card-check"
          type="checkbox"
          aria-label={`${q.name} 선택`}
          checked={selected.includes(q.id)}
          onChange={(e) => toggleQuestion(q.id, e.target.checked)}
        />
      </div>
      <div className="card-bottom">
        <div>
          <h3>{q.name}</h3>
          <span>
            {q.bundle
              ? `지문 + ${q.bundle.questionIds.length}문제`
              : q.source?.kind === "passage"
                ? "공통 지문"
                : "이미지 문제"}{" "}
            <i /> {new Date(q.createdAt).toLocaleDateString("ko-KR")}
          </span>
        </div>
        <div className="card-menu">
          <button
            className="icon"
            aria-label={`${q.name} 수정 및 삭제`}
            onClick={() => setMenu(menu === q.id ? undefined : q.id)}
          >
            <Ellipsis size={19} />
          </button>
          {menu === q.id && (
            <div className="dropdown">
              <button onClick={() => openEdit(q)}>이름·메모 수정</button>
              <button className="danger" onClick={() => removeQuestion(q.id)}>
                문제 삭제
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
