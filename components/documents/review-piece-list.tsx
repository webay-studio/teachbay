"use client";
import { useState } from "react";
import type { Piece } from "../../lib/documents/types";
import {
  bundleOwner,
  bundleRange,
  registrationUnitCount,
} from "../../lib/documents/passage-bundles";

export function ReviewPieceList({
  pieces,
  activeId,
  included,
  includedPieces,
  busy,
  label,
  onFocus,
  onToggle,
  onSelectAll,
  onClear,
}: {
  pieces: Piece[];
  activeId?: string;
  included: string[];
  includedPieces: Piece[];
  busy: boolean;
  label: (piece: Piece) => string;
  onFocus: (piece: Piece) => void;
  onToggle: (piece: Piece, checked: boolean) => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  const [selecting, setSelecting] = useState(false);
  const activeUnitId = activeId
    ? (bundleOwner(pieces, activeId)?.id ?? activeId)
    : undefined;
  const groups = [
    {
      title: "지문 묶음",
      aria: "지문 묶음 목록",
      items: pieces.filter((p) => !!p.bundleQuestionIds?.length),
    },
    {
      title: "개별 문제",
      aria: "문제 목록",
      items: pieces.filter(
        (p) => p.kind !== "passage" && !bundleOwner(pieces, p.id),
      ),
    },
    {
      title: "공통 지문",
      aria: "지문 목록",
      items: pieces.filter(
        (p) => p.kind === "passage" && !p.bundleQuestionIds?.length,
      ),
    },
  ];
  return (
    <div className="pieces-panel">
      <div className="pieces-toolbar">
        <strong>
          저장할 문제{" "}
          <span className="review-selection-count">
            {registrationUnitCount(includedPieces)}개
          </span>
        </strong>
        <button
          className="text-btn review-select-toggle"
          disabled={busy}
          aria-expanded={selecting}
          onClick={() => setSelecting(!selecting)}
        >
          {selecting ? "선택 완료" : "선택 변경"}
        </button>
      </div>
      {selecting && (
        <div className="review-selection-actions">
          <span>저장할 항목만 체크하세요.</span>
          <button className="text-btn" disabled={busy} onClick={onSelectAll}>
            전체 선택
          </button>
          <button className="text-btn" disabled={busy} onClick={onClear}>
            선택 해제
          </button>
        </div>
      )}
      <div className="piece-list compact-piece-list">
        {groups.map(
          ({ title, aria, items }) =>
            items.length > 0 && (
              <section className="piece-group" key={aria} aria-label={aria}>
                <h3>
                  {title}
                  <span>{items.length}</span>
                </h3>
                <div
                  className={`piece-chip-grid ${title === "지문 묶음" ? "bundle-unit-grid" : ""}`}
                >
                  {items.map((p) => {
                    const bundled = !!p.bundleQuestionIds?.length;
                    const checked = includedPieces.some(
                      (item) => item.id === p.id,
                    );
                    const name = bundled
                      ? `${bundleRange(pieces, p)}번 지문 묶음`
                      : p.name;
                    return (
                      <div
                        key={p.id}
                        data-piece-id={p.id}
                        className={`piece-chip ${p.id === activeUnitId ? "active" : ""} ${bundled ? "bundled" : ""} ${checked ? "" : "excluded"}`}
                      >
                        {selecting && (
                          <input
                            type="checkbox"
                            aria-label={`${name} 저장 선택`}
                            checked={checked}
                            disabled={
                              busy ||
                              (!bundled && !included.includes(p.id) && checked)
                            }
                            onChange={(e) => onToggle(p, e.target.checked)}
                          />
                        )}
                        <button
                          type="button"
                          disabled={busy}
                          aria-pressed={p.id === activeUnitId}
                          aria-label={
                            bundled
                              ? `${name} 선택`
                              : `${p.kind === "passage" ? "지문" : "문제"} ${label(p)} 선택`
                          }
                          title={name}
                          onClick={() => onFocus(p)}
                        >
                          <span>
                            {bundled ? `${bundleRange(pieces, p)}번` : label(p)}
                          </span>
                          {!checked && <small>제외</small>}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            ),
        )}
        {!pieces.length && (
          <p className="muted">원본을 드래그해 문제를 추가하세요.</p>
        )}
      </div>
    </div>
  );
}
