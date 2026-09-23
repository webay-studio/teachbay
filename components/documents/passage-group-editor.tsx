"use client";
import { useState } from "react";
import type { Piece } from "../../lib/documents/types";
import {
  bundleMembers,
  bundleRange,
  questionLabel,
  setPassageBundle,
} from "../../lib/documents/passage-bundles";

export function PassageGroupEditor({
  passage,
  pieces,
  busy,
  onChange,
}: {
  passage: Piece;
  pieces: Piece[];
  busy: boolean;
  onChange: (pieces: Piece[]) => void;
}) {
  const questions = pieces.filter(
    (p) =>
      p.kind === "question" &&
      (!passage.sectionId || p.sectionId === passage.sectionId),
  );
  const related = passage.bundleQuestionIds?.length
    ? bundleMembers(pieces, passage)
    : questions.filter((p) => p.materialIds?.includes(passage.id));
  const [start, setStart] = useState(related[0]?.id ?? "");
  const [end, setEnd] = useState(related.at(-1)?.id ?? "");
  const [error, setError] = useState("");
  const grouped = !!passage.bundleQuestionIds?.length;
  return (
    <section className="passage-bundle-editor" aria-label="지문 문제 묶기">
      <strong>
        {grouped
          ? `${bundleRange(pieces, passage)}번 함께 저장`
          : "이 지문을 쓰는 문제"}
      </strong>
      <div className="passage-bundle-range">
        <select
          aria-label="묶음 시작 문제"
          value={start}
          disabled={busy}
          onChange={(e) => {
            setStart(e.target.value);
            setError("");
            if (!end) setEnd(e.target.value);
          }}
        >
          <option value="">시작 문제</option>
          {questions.map((p, i) => (
            <option key={p.id} value={p.id}>
              {questionLabel(p)}번
              {questions.some(
                (q, j) => j !== i && questionLabel(q) === questionLabel(p),
              )
                ? ` (${i + 1}번째)`
                : ""}
            </option>
          ))}
        </select>
        <span>~</span>
        <select
          aria-label="묶음 끝 문제"
          value={end}
          disabled={busy}
          onChange={(e) => {
            setEnd(e.target.value);
            setError("");
          }}
        >
          <option value="">끝 문제</option>
          {questions.map((p, i) => (
            <option key={p.id} value={p.id}>
              {questionLabel(p)}번
              {questions.some(
                (q, j) => j !== i && questionLabel(q) === questionLabel(p),
              )
                ? ` (${i + 1}번째)`
                : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="passage-bundle-actions">
        <button
          className="btn"
          disabled={busy || !start || !end}
          onClick={() => {
            try {
              onChange(setPassageBundle(pieces, passage.id, start, end));
              setError("");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          {grouped ? "범위 변경" : "한 문제로 묶기"}
        </button>
        {grouped && (
          <button
            className="text-btn"
            disabled={busy}
            onClick={() =>
              onChange(
                pieces.map((p) =>
                  p.id === passage.id
                    ? { ...p, bundleQuestionIds: undefined }
                    : p,
                ),
              )
            }
          >
            묶기 해제
          </button>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
