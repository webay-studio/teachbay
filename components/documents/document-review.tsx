"use client";
import dynamic from "next/dynamic";
import type { EditableDraft } from "../../lib/documents/editable-preview";
import { reviewErrors } from "../../lib/documents/review";
import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Undo2,
  ArrowRight,
  MousePointer2,
  Eraser,
  Trash2,
} from "lucide-react";
import { useBlobUrl } from "../shared";
import {
  fragmentErasures,
  intersectRect,
} from "../../lib/documents/print-cleanup";
import { RegistrationHeaderActions } from "./registration-header";
import { ReviewPieceList } from "./review-piece-list";
import { PassageGroupEditor } from "./passage-group-editor";
import {
  bundleMembers,
  bundleOwner,
  bundleRange,
  registrationUnitCount,
  toggleBundleSelection,
} from "../../lib/documents/passage-bundles";
import { RegionCanvas } from "./region-canvas";
import { ReviewBoard, REVIEW_PAPER_WIDTH } from "./review-board";
import type {
  DocumentPage,
  ImportedDocument,
  PendingQuestion,
  Piece,
  Rect,
} from "../../lib/documents/types";
import { prepareRegistration } from "../../lib/documents/prepare-registration";
import { selectedPiecesForRegistration } from "../../lib/documents/review";
const EditablePreview = dynamic(() => import("./editable-preview"), {
  ssr: false,
});
function PieceThumb({
  page,
  piece,
  index,
}: {
  page: DocumentPage;
  piece: Piece;
  index: number;
}) {
  const rect = piece.fragments[index].rect;
  const erasures = fragmentErasures(page, piece, index);
  const url = useBlobUrl(page.asset.blob);
  return (
    <div
      className="piece-thumb"
      style={{
        aspectRatio: `${page.asset.width * rect.w}/${page.asset.height * rect.h}`,
        width: "100%",
      }}
    >
      <img
        src={url || undefined}
        alt="분리된 영역 미리보기"
        style={{
          width: `${100 / rect.w}%`,
          maxWidth: "none",
          position: "absolute",
          left: 0,
          top: 0,
          transform: `translate(${-rect.x * 100}%, ${-rect.y * 100}%)`,
        }}
      />
      {erasures.map((mask, i) => (
        <span
          key={i}
          className="print-erasure"
          style={{
            position: "absolute",
            background: "#fff",
            pointerEvents: "none",
            left: `${((mask.x - rect.x) / rect.w) * 100}%`,
            top: `${((mask.y - rect.y) / rect.h) * 100}%`,
            width: `${(mask.w / rect.w) * 100}%`,
            height: `${(mask.h / rect.h) * 100}%`,
          }}
        />
      ))}
    </div>
  );
}
export function DocumentReview({
  document: initial,
  onDraftChange,
  onBusyChange,
  onAccept,
}: {
  document: ImportedDocument;
  onDraftChange: (pieces: Piece[], selectedIds: string[]) => void;
  onBusyChange: (busy: boolean) => void;
  onAccept: (items: PendingQuestion[]) => void | Promise<void>;
}) {
  const [pieces, setPieces] = useState(initial.pieces),
    [history, setHistory] = useState<
      {
        pieces: Piece[];
        included: string[];
        activeId?: string;
        fragmentIndex: number;
        pageIndex: number;
      }[]
    >([]),
    [pageIndex, setPageIndex] = useState(0),
    [activeId, setActiveId] = useState<string | undefined>(
      initial.pieces[0]?.id,
    ),
    [included, setIncluded] = useState<string[]>(
      initial.selectedIds ??
        initial.pieces.filter((p) => p.kind !== "passage").map((p) => p.id),
    ),
    [fragmentIndex, setFragmentIndex] = useState(0),
    [mode, setMode] = useState<"select" | "new" | "erase">("select"),
    [ack, setAck] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [progress, setProgress] = useState("");
  const [previewMode, setPreviewMode] = useState<"image" | "text">("image");
  const editableCache = useRef(new Map<string, EditableDraft>());
  const [hand, setHand] = useState(false);
  const [newKind, setNewKind] = useState<"question" | "passage">("question");
  const draftChange = useRef(onDraftChange);
  draftChange.current = onDraftChange;
  useEffect(() => {
    draftChange.current(pieces, included);
  }, [pieces, included]);
  useEffect(() => {
    onBusyChange(busy);
    return () => onBusyChange(false);
  }, [busy, onBusyChange]);
  const controller = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => controller.current?.abort(), []);
  const includedPieces = selectedPiecesForRegistration(pieces, included);
  const page = initial.pages[pageIndex];
  const active = pieces.find((p) => p.id === activeId) ?? pieces[0];
  const activeBundle = active ? bundleOwner(pieces, active.id) : undefined;
  const bundlePieces = activeBundle
    ? [activeBundle, ...bundleMembers(pieces, activeBundle)]
    : [];
  const previewPieces = active ? [active] : [];
  const activeIncluded = includedPieces.some((p) => p.id === active?.id);
  const previewSaveScope = activeBundle
    ? activeIncluded
      ? `공통 지문 + ${bundleRange(pieces, activeBundle)}번 묶음으로 저장`
      : `${bundleRange(pieces, activeBundle)}번 묶음 · 저장 제외`
    : activeIncluded
      ? ""
      : "저장 제외";
  function change(next: Piece[]) {
    setHistory((h) => [
      ...h.slice(-29),
      { pieces, included, activeId: active?.id, fragmentIndex, pageIndex },
    ]);
    setPieces(
      next.map((p) =>
        pieces.find((old) => old.id === p.id) === p
          ? p
          : { ...p, confirmed: false },
      ),
    );
    setIncluded((ids) => [
      ...ids.filter((id) => next.some((p) => p.id === id)),
      ...next
        .filter((p) => !pieces.some((old) => old.id === p.id))
        .map((p) => p.id),
    ]);
    setAck(false);
  }
  function updateBundle(next: Piece[], passageId: string) {
    change(next);
    setError("");
    const passage = next.find((p) => p.id === passageId);
    if (!passage) return;
    focus(passage);
    if (passage.bundleQuestionIds?.length)
      setIncluded((ids) => [
        ...new Set([...ids, passage.id, ...passage.bundleQuestionIds!]),
      ]);
  }
  function modify(next: Piece) {
    change(pieces.map((p) => (p.id === next.id ? next : p)));
  }
  function focus(p: Piece, index = 0) {
    setHand(false);
    setActiveId(p.id);
    setFragmentIndex(index);
    setMode("select");
    setPageIndex(
      initial.pages.findIndex((page) => page.id === p.fragments[index].pageId),
    );
  }
  function label(piece: Piece) {
    if (piece.kind === "passage")
      return String(
        pieces
          .filter((p) => p.kind === "passage")
          .findIndex((p) => p.id === piece.id) + 1,
      );
    return (
      piece.originalLabel?.replace(/[.번]\s*$/, "") ||
      String(
        piece.number ??
          pieces
            .filter((p) => p.kind !== "passage")
            .findIndex((p) => p.id === piece.id) + 1,
      )
    );
  }
  function undo() {
    const previous = history.at(-1);
    if (!previous || busy) return;
    setPieces(previous.pieces);
    setIncluded(previous.included);
    setActiveId(previous.activeId);
    setFragmentIndex(previous.fragmentIndex);
    setPageIndex(previous.pageIndex);
    setHistory((items) => items.slice(0, -1));
    setAck(false);
    setMode("select");
  }
  function updateRegion(piece: Piece, index: number, rect: Rect) {
    const old = piece.fragments[index];
    if (
      ["x", "y", "w", "h"].every(
        (key) => old.rect[key as keyof Rect] === rect[key as keyof Rect],
      )
    )
      return;
    modify({
      ...piece,
      fragments: piece.fragments.map((f, i) =>
        i === index
          ? {
              ...f,
              rect,
              candidateRect: f.candidateRect ?? f.rect,
              content: f.content
                ? { ...f.content, state: "manual" }
                : undefined,
            }
          : f,
      ),
    });
  }
  function removePiece(piece: Piece) {
    if (busy) return;
    if (
      pieces.some(
        (p) =>
          p.materialIds?.includes(piece.id) ||
          p.dependencyIds?.includes(piece.id),
      )
    ) {
      setError(
        "다른 문제에 필요한 자료입니다. 연결된 문제를 먼저 삭제하거나 지문 묶기를 해제해주세요.",
      );
      return;
    }
    const next = pieces
      .filter((p) => p.id !== piece.id)
      .map((p) =>
        p.bundleQuestionIds?.includes(piece.id)
          ? {
              ...p,
              bundleQuestionIds: p.bundleQuestionIds.filter(
                (id) => id !== piece.id,
              ),
            }
          : p,
      );
    change(next);
    if (active?.id === piece.id) {
      setActiveId(next[0]?.id);
      setFragmentIndex(0);
    }
  }
  function commit(rect: Rect) {
    if (mode === "erase") {
      if (!active) return;
      const mask = intersectRect(rect, active.fragments[fragmentIndex].rect);
      if (mask)
        modify({
          ...active,
          fragments: active.fragments.map((f, i) =>
            i === fragmentIndex
              ? { ...f, erasures: [...(f.erasures ?? []), mask] }
              : f,
          ),
        });
      return;
    }
    if (rect.w < 0.01 || rect.h < 0.005) return;
    const f = { pageId: page.id, rect };
    if (mode === "new" || mode === "select") {
      const number =
        Math.max(
          0,
          ...pieces
            .filter((p) => p.kind === "question")
            .map(
              (p) =>
                Number(p.originalLabel?.replace(/[.번]\s*$/, "") ?? p.number) ||
                0,
            ),
        ) + 1;
      const p: Piece = {
        id: crypto.randomUUID(),
        name:
          newKind === "question"
            ? `${number}번`
            : `지문 ${pieces.filter((p) => p.kind === "passage").length + 1}`,
        kind: newKind,
        number: newKind === "question" ? number : undefined,
        originalLabel: newKind === "question" ? String(number) : undefined,
        fragments: [f],
        warnings: [],
      };
      change([...pieces, p]);
      setActiveId(p.id);
      setFragmentIndex(0);
    }
    setMode("select");
  }
  async function accept() {
    const issues = reviewErrors(includedPieces);
    if (issues.length) {
      setError(issues.join(" "));
      return;
    }
    setBusy(true);
    setError("");
    const c = new AbortController();
    controller.current = c;
    try {
      const rows = await prepareRegistration(
        initial,
        includedPieces,
        c.signal,
        setProgress,
      );
      if (!c.signal.aborted) await onAccept(rows);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "분리한 이미지를 만들지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="registration-review"
      aria-label={`${initial.filename} 분리 결과`}
    >
      <div className="document-review">
        <div className="review-layout region-editor-layout">
          <div className="source-panel">
            <div className="source-nav">
              <button
                className="icon"
                disabled={pageIndex === 0 || busy}
                aria-label="이전 원본 페이지"
                onClick={() => setPageIndex(pageIndex - 1)}
              >
                <ChevronLeft size={19} />
              </button>
              <span>
                원본 · {pageIndex + 1} / {initial.pages.length}쪽
              </span>
              <button
                className="icon"
                disabled={pageIndex === initial.pages.length - 1 || busy}
                aria-label="다음 원본 페이지"
                onClick={() => setPageIndex(pageIndex + 1)}
              >
                <ChevronRight size={19} />
              </button>
            </div>
            <div className="region-editor-toolbar" aria-label="영역 편집 도구">
              <button
                className="btn"
                aria-pressed={!hand && mode === "select"}
                disabled={busy}
                onClick={() => {
                  setHand(false);
                  setMode("select");
                }}
              >
                <MousePointer2 size={14} />
                선택·이동
              </button>
              <button
                className="btn"
                aria-pressed={!hand && mode === "new" && newKind === "question"}
                disabled={busy}
                onClick={() => {
                  setHand(false);
                  setNewKind("question");
                  setMode("new");
                }}
              >
                <Plus size={14} />
                문제 추가
              </button>
              <button
                className="btn"
                aria-pressed={!hand && mode === "new" && newKind === "passage"}
                disabled={busy}
                onClick={() => {
                  setHand(false);
                  setNewKind("passage");
                  setMode("new");
                }}
              >
                <Plus size={14} />
                지문 추가
              </button>
              <button
                className="btn"
                aria-pressed={!hand && mode === "erase"}
                disabled={busy || !active}
                onClick={() => {
                  if (active) {
                    focus(active, fragmentIndex);
                    setMode("erase");
                  }
                }}
              >
                <Eraser size={14} /> 지우기
              </button>
              <button
                className="icon"
                aria-label="영역 수정 되돌리기"
                title="되돌리기"
                disabled={busy || !history.length}
                onClick={undo}
              >
                <Undo2 size={16} />
              </button>
            </div>
            <ReviewBoard
              aspect={page.asset.width / page.asset.height}
              hand={hand}
              onHandChange={setHand}
              source={
                <RegionCanvas
                  page={page}
                  pieces={pieces}
                  activeId={active?.id}
                  fragmentIndex={fragmentIndex}
                  mode={mode}
                  width={REVIEW_PAPER_WIDTH}
                  busy={busy}
                  label={label}
                  onSelect={focus}
                  onChange={updateRegion}
                  onDraw={commit}
                  onCancel={() => setMode("select")}
                  onDelete={() => {
                    if (active) removePiece(active);
                  }}
                  onUndo={undo}
                />
              }
              preview={
                active && (
                  <section
                    className="selected-piece-preview"
                    aria-label="미리보기"
                    key={`preview-${active.id}`}
                  >
                    <div
                      className="review-preview-topline"
                      data-board-interactive="true"
                    >
                      <h4>미리보기</h4>
                      <div
                        className="review-preview-modes"
                        aria-label="미리보기 방식"
                      >
                        <button
                          type="button"
                          aria-pressed={previewMode === "image"}
                          onClick={() => setPreviewMode("image")}
                        >
                          이미지
                        </button>
                        <button
                          type="button"
                          aria-pressed={previewMode === "text"}
                          onClick={() => setPreviewMode("text")}
                        >
                          텍스트 편집 · 실험
                        </button>
                      </div>
                    </div>
                    <div className="review-preview-crops">
                      {previewPieces.map((item) => (
                        <div className="review-preview-item" key={item.id}>
                          <div className="review-preview-heading" role="status">
                            <h5>
                              {item.kind === "passage"
                                ? "공통 지문"
                                : `문제 ${label(item)}`}
                            </h5>
                            {previewSaveScope && (
                              <p className="review-preview-save-scope">
                                {previewSaveScope}
                              </p>
                            )}
                          </div>
                          {previewMode === "text" ? (
                            <EditablePreview
                              key={JSON.stringify([
                                item.id,
                                item.fragments,
                                item.cleanPrint,
                              ])}
                              piece={item}
                              pages={initial.pages}
                              cache={editableCache.current}
                              busy={busy}
                            />
                          ) : (
                            item.fragments.map((f, i) => (
                              <PieceThumb
                                key={`${item.id}-${f.pageId}-${i}`}
                                page={initial.pages.find(
                                  (p) => p.id === f.pageId,
                                )!}
                                piece={item}
                                index={i}
                              />
                            ))
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )
              }
            />
            <p className="region-editor-hint">
              {mode === "erase"
                ? "선택한 문제에서 지울 부분을 드래그하세요. 미리보기와 저장 이미지에 반영돼요."
                : "배경 드래그로 이동 · 시험지 위에서 영역 편집 · Ctrl/⌘ + 휠로 확대"}
              {mode !== "select" && (
                <button
                  className="text-btn"
                  onClick={() => {
                    setHand(false);
                    setMode("select");
                  }}
                >
                  선택 모드로
                </button>
              )}
            </p>
          </div>
          <aside
            className="review-options-panel"
            aria-label="문제 설정 및 저장"
          >
            <div className="review-sidebar-scroll">
              <ReviewPieceList
                pieces={pieces}
                activeId={active?.id}
                included={included}
                includedPieces={includedPieces}
                busy={busy}
                label={label}
                onFocus={focus}
                onToggle={(piece, checked) => {
                  setIncluded((ids) =>
                    toggleBundleSelection(pieces, ids, piece.id, checked),
                  );
                  setAck(false);
                }}
                onSelectAll={() => {
                  setIncluded(
                    pieces.filter((p) => p.kind !== "passage").map((p) => p.id),
                  );
                  setAck(false);
                }}
                onClear={() => {
                  setIncluded([]);
                  setAck(false);
                }}
              />
              {active && (
                <div className="review-selected-heading">
                  <h3>
                    {activeBundle
                      ? `${bundleRange(pieces, activeBundle)}번 지문 묶음`
                      : `${active.kind === "passage" ? "지문" : "문제"} ${label(active)}`}
                  </h3>
                  <button
                    className="text-btn"
                    aria-label="선택 영역 삭제"
                    disabled={busy}
                    onClick={() => removePiece(active)}
                  >
                    <Trash2 size={14} />
                    {activeBundle
                      ? active.kind === "passage"
                        ? "지문 삭제"
                        : `${label(active)}번 삭제`
                      : "삭제"}
                  </button>
                </div>
              )}
              {activeBundle && (
                <div className="review-bundle-context">
                  <p className="review-bundle-summary" role="status">
                    공통 지문 · 문제{" "}
                    {bundleMembers(pieces, activeBundle).length}개
                    {activeIncluded ? " 함께 저장" : " · 저장 제외"}
                  </p>
                  <div
                    className="review-member-nav"
                    aria-label="묶음 영역 선택"
                  >
                    {bundlePieces.map((piece) => (
                      <button
                        key={piece.id}
                        type="button"
                        disabled={busy}
                        aria-pressed={piece.id === active?.id}
                        aria-label={`${piece.kind === "passage" ? "지문" : "문제"} ${label(piece)} 영역 선택`}
                        onClick={() => focus(piece)}
                      >
                        {piece.kind === "passage"
                          ? "지문"
                          : `${label(piece)}번`}
                      </button>
                    ))}
                  </div>
                  <details
                    className="review-bundle-range"
                    key={activeBundle.id}
                  >
                    <summary>묶음 범위 수정</summary>
                    <PassageGroupEditor
                      key={`${activeBundle.id}:${activeBundle.bundleQuestionIds?.join(",")}`}
                      passage={activeBundle}
                      pieces={pieces}
                      busy={busy}
                      onChange={(next) => updateBundle(next, activeBundle.id)}
                    />
                  </details>
                </div>
              )}
              {!activeBundle && active?.kind === "passage" && (
                <PassageGroupEditor
                  key={active.id}
                  passage={active}
                  pieces={pieces}
                  busy={busy}
                  onChange={(next) => updateBundle(next, active.id)}
                />
              )}
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <RegistrationHeaderActions>
              <div className="review-save-controls">
                <label>
                  <input
                    type="checkbox"
                    checked={ack}
                    disabled={busy}
                    onChange={(e) => {
                      setAck(e.target.checked);
                      if (e.target.checked)
                        setPieces((items) =>
                          items.map((p) =>
                            includedPieces.some((i) => i.id === p.id)
                              ? { ...p, confirmed: true }
                              : p,
                          ),
                        );
                    }}
                  />
                  저장할 문제를 확인했어요.
                </label>
                <button
                  className="btn primary"
                  disabled={
                    busy ||
                    !ack ||
                    !includedPieces.length ||
                    includedPieces.some((p) => !p.name.trim() || !p.confirmed)
                  }
                  onClick={accept}
                >
                  {busy
                    ? progress
                    : `${registrationUnitCount(includedPieces)}문제${includedPieces.some((p) => p.kind === "passage" && !p.bundleQuestionIds?.length) ? " + 공통 자료" : ""} 저장`}
                  <ArrowRight size={16} />
                </button>
              </div>
            </RegistrationHeaderActions>
          </aside>
        </div>
      </div>
    </section>
  );
}
