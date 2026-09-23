"use client";
import { reviewErrors } from "../../lib/documents/review";
import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Undo2,
  ArrowRight,
  MousePointer2,
  ZoomIn,
  ZoomOut,
  Eraser,
  Trash2,
  Link2,
} from "lucide-react";
import { useBlobUrl } from "../shared";
import {
  fragmentErasures,
  intersectRect,
} from "../../lib/documents/print-cleanup";
import { RegistrationHeaderActions } from "./registration-header";
import { PassageGroupEditor } from "./passage-group-editor";
import {
  bundleMembers,
  bundleOwner,
  bundleRange,
  registrationUnitCount,
  toggleBundleSelection,
} from "../../lib/documents/passage-bundles";
import { RegionCanvas } from "./region-canvas";
import type {
  DocumentPage,
  ImportedDocument,
  PendingQuestion,
  Piece,
  Rect,
} from "../../lib/documents/types";
import { prepareRegistration } from "../../lib/documents/prepare-registration";
import { selectedPiecesForRegistration } from "../../lib/documents/review";
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
  const [zoom, setZoom] = useState(1);
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
  const previewPieces = activeBundle
    ? [activeBundle, ...bundleMembers(pieces, activeBundle)]
    : active
      ? [active]
      : [];
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
  function modify(next: Piece) {
    change(pieces.map((p) => (p.id === next.id ? next : p)));
  }
  function focus(p: Piece, index = 0) {
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
                aria-pressed={mode === "select"}
                disabled={busy}
                onClick={() => setMode("select")}
              >
                <MousePointer2 size={14} />
                선택·이동
              </button>
              <button
                className="btn"
                aria-pressed={mode === "new" && newKind === "question"}
                disabled={busy}
                onClick={() => {
                  setNewKind("question");
                  setMode("new");
                }}
              >
                <Plus size={14} />
                문제 추가
              </button>
              <button
                className="btn"
                aria-pressed={mode === "new" && newKind === "passage"}
                disabled={busy}
                onClick={() => {
                  setNewKind("passage");
                  setMode("new");
                }}
              >
                <Plus size={14} />
                지문 추가
              </button>
              <button
                className="btn"
                aria-pressed={mode === "erase"}
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
              <span className="region-editor-zoom">
                <button
                  className="icon"
                  aria-label="원본 축소"
                  disabled={zoom <= 0.5}
                  onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                >
                  <ZoomOut size={16} />
                </button>
                <button
                  className="text-btn"
                  aria-label="원본 한 쪽에 맞추기"
                  onClick={() => setZoom(1)}
                >
                  {zoom === 1 ? "한 쪽" : `${Math.round(zoom * 100)}%`}
                </button>
                <button
                  className="icon"
                  aria-label="원본 확대"
                  disabled={zoom >= 2}
                  onClick={() => setZoom(Math.min(2, zoom + 0.25))}
                >
                  <ZoomIn size={16} />
                </button>
              </span>
            </div>
            <RegionCanvas
              page={page}
              pieces={pieces}
              activeId={active?.id}
              fragmentIndex={fragmentIndex}
              mode={mode}
              zoom={zoom}
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
            <p className="region-editor-hint">
              {mode === "erase"
                ? "선택한 문제에서 지울 부분을 드래그하세요. 미리보기와 저장 이미지에 반영돼요."
                : "빈 곳을 드래그해 추가 · 영역을 잡아 이동 · 모서리로 크기 조절"}
              {mode !== "select" && (
                <button className="text-btn" onClick={() => setMode("select")}>
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
              <div className="pieces-panel">
                <div className="pieces-toolbar">
                  <strong>저장할 문제</strong>
                  <span className="review-selection-count">
                    {registrationUnitCount(includedPieces)}개 선택
                  </span>
                </div>
                <div className="review-selection-actions">
                  <button
                    className="text-btn"
                    disabled={busy}
                    onClick={() => {
                      setIncluded(
                        pieces
                          .filter((p) => p.kind !== "passage")
                          .map((p) => p.id),
                      );
                      setAck(false);
                    }}
                  >
                    전체 선택
                  </button>
                  <button
                    className="text-btn"
                    disabled={busy}
                    onClick={() => {
                      setIncluded([]);
                      setAck(false);
                    }}
                  >
                    선택 해제
                  </button>
                </div>
                <div className="piece-list compact-piece-list">
                  {(["passage", "question"] as const).map((kind) => {
                    const group = pieces.filter((p) =>
                      kind === "passage"
                        ? p.kind === "passage"
                        : p.kind !== "passage",
                    );
                    if (kind === "passage" && !group.length) return null;
                    return (
                      <section
                        className="piece-group"
                        key={kind}
                        aria-label={
                          kind === "passage" ? "지문 목록" : "문제 목록"
                        }
                      >
                        <h3>
                          {kind === "passage" ? "지문" : "문제"}
                          <span>{group.length}</span>
                        </h3>
                        {group.length ? (
                          <div className="piece-chip-grid">
                            {group.map((p) => (
                              <div
                                key={p.id}
                                data-piece-id={p.id}
                                className={`piece-chip ${p.id === active?.id ? "active" : ""} ${bundleOwner(pieces, p.id) ? "bundled" : ""}`}
                              >
                                <input
                                  type="checkbox"
                                  aria-label={`${p.name} 저장 선택`}
                                  disabled={
                                    busy ||
                                    (!bundleOwner(pieces, p.id) &&
                                      !included.includes(p.id) &&
                                      includedPieces.some((x) => x.id === p.id))
                                  }
                                  checked={includedPieces.some(
                                    (x) => x.id === p.id,
                                  )}
                                  onChange={(e) => {
                                    setIncluded((ids) =>
                                      toggleBundleSelection(
                                        pieces,
                                        ids,
                                        p.id,
                                        e.target.checked,
                                      ),
                                    );
                                    setAck(false);
                                  }}
                                />
                                <button
                                  type="button"
                                  disabled={busy}
                                  aria-pressed={p.id === active?.id}
                                  aria-label={`${kind === "passage" ? "지문" : "문제"} ${label(p)} 선택`}
                                  title={`${bundleOwner(pieces, p.id) ? `${bundleRange(pieces, bundleOwner(pieces, p.id)!)}번 지문 묶음 · ` : ""}${p.name} · ${[...new Set(p.fragments.map((f) => initial.pages.find((page) => page.id === f.pageId)!.index + 1))].join(", ")}쪽`}
                                  onClick={() => focus(p)}
                                >
                                  {p.bundleQuestionIds?.length
                                    ? `${bundleRange(pieces, p)}번`
                                    : label(p)}
                                  {bundleOwner(pieces, p.id) && (
                                    <Link2
                                      size={12}
                                      aria-hidden="true"
                                      className="piece-bundle-mark"
                                    />
                                  )}
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="muted">
                            {kind === "passage"
                              ? "등록된 지문이 없어요."
                              : "원본을 드래그해 문제를 추가하세요."}
                          </p>
                        )}
                      </section>
                    );
                  })}
                </div>
              </div>
              {active && (
                <div className="review-selected-heading">
                  <h3>
                    {active.kind === "passage" ? "지문" : "문제"}{" "}
                    {label(active)}
                  </h3>
                  <button
                    className="text-btn"
                    aria-label="선택 영역 삭제"
                    disabled={busy}
                    onClick={() => removePiece(active)}
                  >
                    <Trash2 size={14} /> 삭제
                  </button>
                </div>
              )}
              {activeBundle && (
                <div className="review-bundle-notice" role="status">
                  <div>
                    <strong>
                      <Link2 size={15} />
                      {bundleRange(pieces, activeBundle)}번 지문 묶음
                    </strong>
                    <span>
                      지문과 문제 {bundleMembers(pieces, activeBundle).length}
                      개가 함께 저장돼요.
                    </span>
                  </div>
                  {active?.id !== activeBundle.id && (
                    <button
                      className="text-btn"
                      disabled={busy}
                      onClick={() => focus(activeBundle)}
                    >
                      묶음 수정
                    </button>
                  )}
                </div>
              )}
              {active?.kind === "passage" && (
                <PassageGroupEditor
                  key={`${active.id}:${active.bundleQuestionIds?.join(",") ?? ""}`}
                  passage={active}
                  pieces={pieces}
                  busy={busy}
                  onChange={(next) => {
                    change(next);
                    setError("");
                    const group = next.find((p) => p.id === active.id);
                    if (group?.bundleQuestionIds?.length)
                      setIncluded((ids) => [
                        ...new Set([
                          ...ids,
                          group.id,
                          ...group.bundleQuestionIds!,
                        ]),
                      ]);
                  }}
                />
              )}
              {active && (
                <section
                  className="selected-piece-preview"
                  aria-label="미리보기"
                  key={`preview-${active.id}`}
                >
                  <h4>미리보기</h4>
                  <div className="review-preview-crops">
                    {previewPieces.map((item) => (
                      <div className="review-preview-item" key={item.id}>
                        {activeBundle && (
                          <h5>
                            {item.kind === "passage"
                              ? "공통 지문"
                              : `문제 ${label(item)}`}
                          </h5>
                        )}
                        {item.fragments.map((f, i) => (
                          <PieceThumb
                            key={`${item.id}-${f.pageId}-${i}`}
                            page={initial.pages.find((p) => p.id === f.pageId)!}
                            piece={item}
                            index={i}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </section>
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
