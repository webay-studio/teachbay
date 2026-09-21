"use client";
import {
  applyContentProposal,
  keepCandidate,
} from "../../lib/documents/content-bounds";
import { reviewErrors } from "../../lib/documents/review";
import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Link2,
  Scissors,
  Undo2,
  X,
  Check,
  ArrowRight,
} from "lucide-react";
import { useBlobUrl } from "../shared";
import type {
  ColumnMode,
  DocumentPage,
  ImportedDocument,
  PendingQuestion,
  Piece,
  Rect,
} from "../../lib/documents/types";
import {
  mergePieces,
  segmentDocument,
  splitFragment,
} from "../../lib/documents/segment";
import { prepareRegistration } from "../../lib/documents/prepare-registration";
import { selectedPiecesForRegistration } from "../../lib/documents/review";
function PieceThumb({ page, rect }: { page: DocumentPage; rect: Rect }) {
  const url = useBlobUrl(page.asset.blob);
  return (
    <div
      className="piece-thumb"
      style={{
        aspectRatio: `${page.asset.width * rect.w}/${page.asset.height * rect.h}`,
        width: `min(100%, calc(var(--crop-height, 350px) * ${(page.asset.width * rect.w) / (page.asset.height * rect.h)}))`,
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
    [history, setHistory] = useState<Piece[][]>([]),
    [pageIndex, setPageIndex] = useState(0),
    [activeId, setActiveId] = useState(initial.pieces[0]?.id),
    [selected, setSelected] = useState<string[]>([]),
    [included, setIncluded] = useState<string[]>(
      initial.selectedIds ??
        initial.pieces.filter((p) => p.kind !== "passage").map((p) => p.id),
    ),
    [fragmentIndex, setFragmentIndex] = useState(0),
    [mode, setMode] = useState<"select" | "replace" | "append" | "new">(
      "select",
    ),
    [draw, setDraw] = useState<Rect>(),
    [ratio, setRatio] = useState(0.5),
    [columns, setColumns] = useState<ColumnMode>("auto"),
    [ack, setAck] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [progress, setProgress] = useState("");
  const [mergeMode, setMergeMode] = useState(false);
  const [expandedId, setExpandedId] = useState<string>();
  const draftChange = useRef(onDraftChange);
  draftChange.current = onDraftChange;
  useEffect(() => {
    draftChange.current(pieces, included);
  }, [pieces, included]);
  useEffect(() => {
    onBusyChange(busy);
    return () => onBusyChange(false);
  }, [busy, onBusyChange]);
  const stage = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = listRef.current;
    const card = list?.querySelector<HTMLElement>(
      `[data-piece-id="${activeId}"]`,
    );
    if (list && card)
      list.scrollTop +=
        card.getBoundingClientRect().top - list.getBoundingClientRect().top;
  }, [activeId]);
  const origin = useRef<{ x: number; y: number } | undefined>(undefined);
  const controller = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => controller.current?.abort(), []);
  const includedPieces = selectedPiecesForRegistration(pieces, included);
  const page = initial.pages[pageIndex];
  const url = useBlobUrl(page.asset.blob);
  const active = pieces.find((p) => p.id === activeId) ?? pieces[0];
  const fragment = active?.fragments[fragmentIndex] ?? active?.fragments[0];
  function change(next: Piece[]) {
    setHistory((h) => [...h.slice(-19), pieces]);
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
  function point(e: React.PointerEvent) {
    const r = stage.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    };
  }
  function commit(rect: Rect) {
    if (rect.w < 0.01 || rect.h < 0.005) return;
    const f = { pageId: page.id, rect };
    if (mode === "new") {
      const p: Piece = {
        id: crypto.randomUUID(),
        name: "직접 선택한 영역",
        kind: "other",
        fragments: [f],
        warnings: [],
      };
      change([...pieces, p]);
      setActiveId(p.id);
      setFragmentIndex(0);
    } else if (active && mode === "append") {
      modify({ ...active, fragments: [...active.fragments, f] });
      setFragmentIndex(active.fragments.length);
    } else if (active && mode === "replace") {
      modify({
        ...active,
        fragments: active.fragments.map((old, i) =>
          i === fragmentIndex
            ? {
                ...f,
                candidateRect: old.candidateRect ?? old.rect,
                content: old.content
                  ? { ...old.content, state: "manual" }
                  : undefined,
              }
            : old,
        ),
      });
    }
    setMode("select");
  }
  function downloadTrace() {
    const trace = {
      version: 1,
      coordinates:
        "rect: normalized 0..1, top-left of rendered page; sourceToAnalysis: PDF user space to rendered pixels",
      documentId: initial.id,
      sha256: initial.sha256,
      pages: initial.pages.map((p) => ({
        id: p.id,
        index: p.index,
        width: p.asset.width,
        height: p.asset.height,
        sourceToAnalysis: p.sourceToAnalysis,
        regions: p.regions,
        method: p.method,
        ocrPasses: p.ocrPasses,
        lines: p.lines,
      })),
      pieces,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(trace, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "registration-trace.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
        <details className="review-advanced">
          <summary>분석 정보 · 되돌리기</summary>
          <p className="muted">
            {initial.engine
              ? "실선은 실제 저장 범위입니다. "
              : "실선은 저장 범위, 회색 점선은 탐색 범위, 주황 점선은 본문 끝 제안입니다. "}
            자동 분리는 틀릴 수 있고 필기는 남을 수 있어요.
          </p>
          {initial.warnings.map((w) => (
            <p className="warning" key={w}>
              {w}
            </p>
          ))}
          <div className="review-controls">
            <button
              className="text-btn"
              disabled={busy}
              onClick={downloadTrace}
            >
              분석 기록 저장
            </button>
            {!initial.engine && (
              <>
                <label>
                  원본 단 구성
                  <select
                    aria-label="원본 단 구성"
                    value={columns}
                    disabled={busy}
                    onChange={(e) => setColumns(e.target.value as ColumnMode)}
                  >
                    <option value="auto">자동 감지</option>
                    <option value="1">1단</option>
                    <option value="2">2단</option>
                  </select>
                </label>
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() => {
                    if (
                      history.length &&
                      !confirm(
                        "수정한 분리 결과를 자동 분석 결과로 바꿀까요? 되돌리기로 복원할 수 있습니다.",
                      )
                    )
                      return;
                    const next = segmentDocument(initial.pages, columns);
                    change(next);
                    if (next[0]) focus(next[0]);
                    setSelected([]);
                  }}
                >
                  다시 분리
                </button>
              </>
            )}
            <button
              className="text-btn"
              disabled={!history.length || busy}
              onClick={() => {
                setPieces(history.at(-1)!);
                setHistory(history.slice(0, -1));
                setAck(false);
              }}
            >
              <Undo2 size={14} />
              되돌리기
            </button>
            <span>
              자동 감지 {pieces.length}개 · 원본 {initial.pages.length}쪽
            </span>
          </div>
        </details>
        <div className="review-layout">
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
            <div
              className={`source-stage ${mode !== "select" ? "drawing" : ""}`}
              style={{
                width: `min(100%, calc(var(--source-height) * ${page.asset.width / page.asset.height}))`,
              }}
              ref={stage}
              onPointerDown={(e) => {
                if (mode === "select" || busy) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                origin.current = point(e);
                setDraw({ ...origin.current, w: 0, h: 0 });
              }}
              onPointerMove={(e) => {
                if (!origin.current) return;
                const p = point(e);
                setDraw({
                  x: Math.min(p.x, origin.current.x),
                  y: Math.min(p.y, origin.current.y),
                  w: Math.abs(p.x - origin.current.x),
                  h: Math.abs(p.y - origin.current.y),
                });
              }}
              onPointerUp={() => {
                if (draw) commit(draw);
                origin.current = undefined;
                setDraw(undefined);
              }}
              onPointerCancel={() => {
                origin.current = undefined;
                setDraw(undefined);
              }}
            >
              <img
                src={url || undefined}
                alt={`${pageIndex + 1}쪽 원본 문서`}
                draggable={false}
              />
              {pieces.flatMap((p) =>
                p.fragments.flatMap((f, i) =>
                  f.pageId !== page.id
                    ? []
                    : [
                        f.candidateRect && (
                          <div
                            key={`${p.id}-${i}-candidate`}
                            aria-hidden="true"
                            style={{
                              position: "absolute",
                              pointerEvents: "none",
                              border: "2px dashed #666",
                              left: `${f.candidateRect.x * 100}%`,
                              top: `${f.candidateRect.y * 100}%`,
                              width: `${f.candidateRect.w * 100}%`,
                              height: `${f.candidateRect.h * 100}%`,
                            }}
                          />
                        ),
                        f.content?.state === "proposal" &&
                          f.content.proposal && (
                            <div
                              key={`${p.id}-${i}-proposal`}
                              aria-hidden="true"
                              style={{
                                position: "absolute",
                                pointerEvents: "none",
                                border: "3px dashed #d97706",
                                zIndex: 3,
                                left: `${f.content.proposal.x * 100}%`,
                                top: `${f.content.proposal.y * 100}%`,
                                width: `${f.content.proposal.w * 100}%`,
                                height: `${f.content.proposal.h * 100}%`,
                              }}
                            />
                          ),
                      ],
                ),
              )}
              {pieces.flatMap((p, i) =>
                p.fragments.map((f, n) =>
                  f.pageId === page.id ? (
                    <button
                      key={`${p.id}-${n}`}
                      data-piece-id={p.id}
                      data-fragment-index={n}
                      className={`region-overlay ${p.id === active?.id ? "active" : ""} ${p.kind === "passage" ? "passage" : ""}`}
                      disabled={mode !== "select" || busy}
                      style={{
                        left: `${f.rect.x * 100}%`,
                        top: `${f.rect.y * 100}%`,
                        width: `${f.rect.w * 100}%`,
                        height: `${f.rect.h * 100}%`,
                      }}
                      aria-label={`${p.name}, ${n + 1}번째 영역 선택`}
                      onClick={() => focus(p, n)}
                    >
                      <span>
                        {i + 1} · {p.kind === "passage" ? "지문" : p.name}
                      </span>
                    </button>
                  ) : null,
                ),
              )}
              {draw && (
                <div
                  className="draw-region"
                  style={{
                    left: `${draw.x * 100}%`,
                    top: `${draw.y * 100}%`,
                    width: `${draw.w * 100}%`,
                    height: `${draw.h * 100}%`,
                  }}
                />
              )}
            </div>
            {page.warnings.length > 0 && (
              <details className="page-notices">
                <summary>페이지 확인 사항 {page.warnings.length}개</summary>
                {page.warnings.map((w) => (
                  <p className="warning" key={w}>
                    {w}
                  </p>
                ))}
              </details>
            )}
            <div className="source-tools">
              <button
                className="btn"
                disabled={busy}
                onClick={() => setMode(mode === "new" ? "select" : "new")}
              >
                <Plus size={14} />
                문제 직접 추가
              </button>
              <button
                className="text-btn"
                disabled={busy}
                onClick={() => {
                  const p: Piece = {
                    id: crypto.randomUUID(),
                    name: `${pageIndex + 1}쪽 · 수동 영역`,
                    kind: "other",
                    fragments: [
                      {
                        pageId: page.id,
                        rect: { x: 0.05, y: 0.05, w: 0.9, h: 0.3 },
                      },
                    ],
                    warnings: [],
                  };
                  change([...pieces, p]);
                  focus(p);
                }}
              >
                키보드로 추가
              </button>
            </div>
            <p className="muted">
              {mode === "select"
                ? "빠진 문제는 ‘문제 직접 추가’로 드래그하세요."
                : mode === "append"
                  ? "이어서 붙일 부분을 원본에서 드래그하세요. 다른 페이지로 이동해도 됩니다."
                  : "원본에서 남길 사각형 영역을 드래그하세요."}
              {mode !== "select" && (
                <button className="text-btn" onClick={() => setMode("select")}>
                  지정 취소
                </button>
              )}
            </p>
          </div>
          <div className="pieces-panel">
            <div className="pieces-toolbar">
              <strong>추출한 문제 {pieces.length}개</strong>
              <button
                className="text-btn"
                disabled={busy}
                onClick={() => {
                  setMergeMode(!mergeMode);
                  setSelected([]);
                }}
              >
                {mergeMode ? "묶기 마침" : "영역 묶기"}
              </button>
              {mergeMode && (
                <>
                  <button
                    className="text-btn"
                    disabled={selected.length < 2 || busy}
                    onClick={() => {
                      if (
                        new Set(
                          pieces
                            .filter((p) => selected.includes(p.id))
                            .map((p) => p.kind),
                        ).size > 1
                      ) {
                        setError(
                          "문제와 공통 지문은 따로 보관합니다. 같은 종류의 영역끼리 묶어주세요.",
                        );
                        return;
                      }
                      const next = mergePieces(pieces, selected);
                      change(next);
                      const merged = next.find((p) => selected.includes(p.id));
                      if (merged) focus(merged);
                      setSelected([]);
                    }}
                  >
                    <Link2 size={14} />
                    선택 묶기 ({selected.length})
                  </button>
                </>
              )}
            </div>
            {active && (
              <div className="review-quick-actions">
                <span>{active.name}</span>
                <button
                  className="text-btn"
                  disabled={busy}
                  onClick={() => {
                    focus(active, fragmentIndex);
                    setMode("replace");
                  }}
                >
                  범위 조절
                </button>
                {fragment?.content?.proposal &&
                  fragment.content.state !== "chosen" && (
                    <button
                      className="text-btn"
                      disabled={busy}
                      onClick={() =>
                        modify({
                          ...active,
                          fragments: active.fragments.map((f, i) =>
                            i === fragmentIndex ? applyContentProposal(f) : f,
                          ),
                        })
                      }
                    >
                      본문 끝 제안 적용
                    </button>
                  )}
                <span className="muted">
                  {fragment?.content?.state === "chosen"
                    ? "제안 적용 · 확인 필요"
                    : !active.confirmed
                      ? "원본과 비교해주세요"
                      : "확인됨"}
                </span>
              </div>
            )}
            <div className="review-selection-actions">
              <button
                className="text-btn"
                disabled={busy}
                onClick={() => {
                  setIncluded(
                    pieces.filter((p) => p.kind !== "passage").map((p) => p.id),
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
            <div className="piece-list" ref={listRef}>
              {pieces.map((p, i) => {
                return (
                  <article
                    data-piece-id={p.id}
                    className={`piece-card ${p.id === active?.id ? "active" : ""} ${expandedId === p.id ? "expanded" : ""}`}
                    key={p.id}
                  >
                    <label className="piece-save-select">
                      <input
                        type="checkbox"
                        aria-label={`${p.name} 저장 선택`}
                        disabled={
                          busy ||
                          (!included.includes(p.id) &&
                            includedPieces.some((x) => x.id === p.id))
                        }
                        checked={includedPieces.some((x) => x.id === p.id)}
                        onChange={(e) => {
                          setIncluded((ids) =>
                            e.target.checked
                              ? [...ids, p.id]
                              : ids.filter((id) => id !== p.id),
                          );
                          setAck(false);
                        }}
                      />
                      {p.kind === "passage" ? "공통 자료 함께 저장" : p.name}
                    </label>
                    <div className="piece-card-head">
                      {mergeMode && (
                        <input
                          type="checkbox"
                          aria-label={`${p.name} 합치기 선택`}
                          checked={selected.includes(p.id)}
                          disabled={busy}
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? [...selected, p.id]
                                : selected.filter((id) => id !== p.id),
                            )
                          }
                        />
                      )}
                      <button
                        className="piece-name"
                        disabled={busy}
                        onClick={() => focus(p)}
                      >
                        원본 위치 보기
                      </button>
                      <button
                        className="text-btn"
                        disabled={busy}
                        onClick={() =>
                          setExpandedId(expandedId === p.id ? undefined : p.id)
                        }
                      >
                        {expandedId === p.id ? "크기 맞춤" : "크게 보기"}
                      </button>
                      <button
                        className="icon"
                        disabled={busy}
                        aria-label={`${p.name} 분리 결과에서 제외`}
                        onClick={() => {
                          if (
                            pieces.some(
                              (x) =>
                                x.materialIds?.includes(p.id) ||
                                x.dependencyIds?.includes(p.id),
                            )
                          ) {
                            setError(
                              "다른 문제에 필요한 자료입니다. 상세 수정에서 연결을 확인한 뒤 제외해주세요.",
                            );
                            return;
                          }
                          change(
                            pieces
                              .filter((x) => x.id !== p.id)
                              .map((x) => ({
                                ...x,
                                materialIds: x.materialIds?.filter(
                                  (id) => id !== p.id,
                                ),
                                dependencyIds: x.dependencyIds?.filter(
                                  (id) => id !== p.id,
                                ),
                              })),
                          );
                          setSelected(selected.filter((id) => id !== p.id));
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    {p.fragments.map((part, index) => (
                      <button
                        key={`${part.pageId}-${index}`}
                        className="piece-preview-button"
                        disabled={busy}
                        onClick={() => focus(p, index)}
                        aria-label={`${p.name} 영역 ${index + 1} 원본 보기`}
                      >
                        <PieceThumb
                          page={initial.pages.find(
                            (page) => page.id === part.pageId,
                          )!}
                          rect={part.rect}
                        />
                      </button>
                    ))}
                    <div className="piece-tags">
                      <span>
                        {p.confirmed
                          ? "확인됨"
                          : p.kind === "passage"
                            ? "공통 지문"
                            : p.kind === "question"
                              ? "문제"
                              : "확인 필요"}
                      </span>
                      <span>
                        {[
                          ...new Set(
                            p.fragments.map(
                              (f) =>
                                initial.pages.find(
                                  (page) => page.id === f.pageId,
                                )!.index + 1,
                            ),
                          ),
                        ].join(", ")}
                        쪽
                      </span>
                      {p.fragments.length > 1 && (
                        <span className="joined-tag">
                          {p.fragments.length}개 영역 이어짐
                        </span>
                      )}
                      {p.group && (
                        <span>{p.group.split(":").at(-1)}번 세트</span>
                      )}
                    </div>
                  </article>
                );
              })}
              {!pieces.length && (
                <p className="empty">
                  남긴 항목이 없어요. 원본에서 새 영역을 지정하세요.
                </p>
              )}
            </div>
            {active && (
              <details className="piece-editor" key={active.id}>
                <summary>선택 영역 상세 수정 · 지문 연결</summary>
                <label className="field">
                  항목 이름
                  <input
                    aria-label="분리 항목 이름"
                    disabled={busy}
                    value={active.name}
                    onChange={(e) =>
                      modify({ ...active, name: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  원문 번호 (이미지 안의 번호는 유지됩니다)
                  <input
                    value={
                      active.originalLabel ?? active.number?.toString() ?? ""
                    }
                    disabled={busy}
                    onChange={(e) =>
                      modify({ ...active, originalLabel: e.target.value })
                    }
                  />
                </label>
                <label className="kind-label">
                  종류
                  <select
                    aria-label="분리 항목 종류"
                    disabled={busy}
                    value={active.kind}
                    onChange={(e) =>
                      modify({
                        ...active,
                        kind: e.target.value as Piece["kind"],
                        materialIds: active.materialIds?.filter(
                          (id) => id !== active.id,
                        ),
                      })
                    }
                  >
                    <option value="question">문제</option>
                    <option value="passage">공통 지문</option>
                    <option value="other">기타 자료</option>
                  </select>
                </label>
                <fieldset disabled={busy}>
                  <legend>필요한 공통 자료</legend>
                  {pieces
                    .filter((p) => p.kind === "passage" && p.id !== active.id)
                    .map((m) => (
                      <label key={m.id} style={{ display: "block" }}>
                        <input
                          type="checkbox"
                          checked={active.materialIds?.includes(m.id) ?? false}
                          onChange={(e) =>
                            modify({
                              ...active,
                              materialIds: e.target.checked
                                ? [...(active.materialIds ?? []), m.id]
                                : (active.materialIds ?? []).filter(
                                    (id) => id !== m.id,
                                  ),
                            })
                          }
                        />
                        {m.name}
                      </label>
                    ))}
                  {!pieces.some(
                    (p) => p.kind === "passage" && p.id !== active.id,
                  ) && <p>연결할 자료의 종류를 공통 지문으로 지정하세요.</p>}
                </fieldset>
                <fieldset disabled={busy}>
                  <legend>다른 문항의 조건·결과 필요</legend>
                  {pieces
                    .filter((p) => p.kind === "question" && p.id !== active.id)
                    .map((q) => (
                      <label key={q.id} style={{ display: "block" }}>
                        <input
                          type="checkbox"
                          checked={
                            active.dependencyIds?.includes(q.id) ?? false
                          }
                          onChange={(e) =>
                            modify({
                              ...active,
                              dependencyIds: e.target.checked
                                ? [...(active.dependencyIds ?? []), q.id]
                                : (active.dependencyIds ?? []).filter(
                                    (id) => id !== q.id,
                                  ),
                            })
                          }
                        />
                        {q.name}
                      </label>
                    ))}
                </fieldset>
                <label>
                  <input
                    type="checkbox"
                    checked={active.confirmed ?? false}
                    disabled={busy}
                    onChange={(e) => {
                      setPieces(
                        pieces.map((p) =>
                          p.id === active.id
                            ? { ...p, confirmed: e.target.checked }
                            : p,
                        ),
                      );
                      setAck(false);
                    }}
                  />
                  이 항목의 경계·순서·자료 연결 확인
                </label>
                <div className="actions">
                  <button
                    className="btn"
                    disabled={busy || fragmentIndex === 0}
                    onClick={() => {
                      const f = [...active.fragments];
                      [f[fragmentIndex - 1], f[fragmentIndex]] = [
                        f[fragmentIndex],
                        f[fragmentIndex - 1],
                      ];
                      modify({ ...active, fragments: f });
                      setFragmentIndex(fragmentIndex - 1);
                    }}
                  >
                    영역 앞으로
                  </button>
                  <button
                    className="btn"
                    disabled={
                      busy || fragmentIndex >= active.fragments.length - 1
                    }
                    onClick={() => {
                      const f = [...active.fragments];
                      [f[fragmentIndex + 1], f[fragmentIndex]] = [
                        f[fragmentIndex],
                        f[fragmentIndex + 1],
                      ];
                      modify({ ...active, fragments: f });
                      setFragmentIndex(fragmentIndex + 1);
                    }}
                  >
                    영역 뒤로
                  </button>
                  <button
                    className="text-btn"
                    disabled={busy || active.fragments.length <= 1}
                    onClick={() => {
                      modify({
                        ...active,
                        fragments: active.fragments.filter(
                          (_, i) => i !== fragmentIndex,
                        ),
                      });
                      setFragmentIndex(0);
                    }}
                  >
                    이 영역 제외
                  </button>
                </div>
                <div className="fragment-tabs">
                  {active.fragments.map((f, i) => (
                    <button
                      key={i}
                      className={i === fragmentIndex ? "chosen" : ""}
                      onClick={() => focus(active, i)}
                    >
                      영역 {i + 1} ·{" "}
                      {initial.pages.find((p) => p.id === f.pageId)!.index + 1}
                      쪽
                    </button>
                  ))}
                </div>
                <div className="actions">
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={() => {
                      if (fragment)
                        setPageIndex(
                          initial.pages.findIndex(
                            (p) => p.id === fragment.pageId,
                          ),
                        );
                      setMode("replace");
                    }}
                  >
                    영역 다시 지정
                  </button>
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={() => setMode("append")}
                  >
                    <Link2 size={13} />
                    이어지는 영역 추가
                  </button>
                </div>
                {fragment?.content && (
                  <div className="content-bounds-review">
                    <strong>
                      본문 범위{" "}
                      {fragment.content.state === "chosen"
                        ? "제안 적용됨 · 확인 필요"
                        : fragment.content.state === "manual"
                          ? "직접 조절됨"
                          : fragment.content.state === "kept"
                            ? "넓은 원본 유지"
                            : "미확정"}
                    </strong>
                    <p>{fragment.content.reason}</p>
                    <p>
                      필기 상태: 제거하지 않았습니다. 본문과 겹친 필기가 남을 수
                      있어요.
                    </p>
                    <div className="actions">
                      {fragment.content.proposal && (
                        <button
                          className="btn"
                          disabled={busy}
                          onClick={() =>
                            modify({
                              ...active,
                              fragments: active.fragments.map((f, i) =>
                                i === fragmentIndex
                                  ? applyContentProposal(f)
                                  : f,
                              ),
                            })
                          }
                        >
                          본문 끝 제안 적용
                        </button>
                      )}
                      <button
                        className="text-btn"
                        disabled={busy}
                        onClick={() =>
                          modify({
                            ...active,
                            fragments: active.fragments.map((f, i) =>
                              i === fragmentIndex ? keepCandidate(f) : f,
                            ),
                          })
                        }
                      >
                        넓은 원본 범위 유지
                      </button>
                    </div>
                  </div>
                )}
                {fragment && (
                  <div className="region-ranges">
                    {(["x", "y", "w", "h"] as const).map((key, i) => (
                      <label key={key}>
                        {["왼쪽", "위쪽", "너비", "높이"][i]}
                        <input
                          type="range"
                          min={key === "w" || key === "h" ? 0.01 : 0}
                          max={
                            key === "w"
                              ? 1 - fragment.rect.x
                              : key === "h"
                                ? 1 - fragment.rect.y
                                : 0.99
                          }
                          step="0.001"
                          value={fragment.rect[key]}
                          disabled={busy}
                          onChange={(e) => {
                            const r = {
                              ...fragment.rect,
                              [key]: Number(e.target.value),
                            };
                            r.w = Math.min(r.w, 1 - r.x);
                            r.h = Math.min(r.h, 1 - r.y);
                            modify({
                              ...active,
                              fragments: active.fragments.map((f, n) =>
                                n === fragmentIndex
                                  ? {
                                      ...f,
                                      rect: r,
                                      content: f.content
                                        ? { ...f.content, state: "manual" }
                                        : undefined,
                                    }
                                  : f,
                              ),
                            });
                          }}
                        />
                      </label>
                    ))}
                  </div>
                )}
                <div className="split-controls">
                  <label>
                    위에서 {Math.round(ratio * 100)}% 지점에서 나누기
                    <input
                      type="range"
                      min=".05"
                      max=".95"
                      step=".01"
                      value={ratio}
                      disabled={busy}
                      onChange={(e) => setRatio(Number(e.target.value))}
                    />
                  </label>
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={() => {
                      change(
                        pieces.flatMap((p) =>
                          p.id === active.id
                            ? splitFragment(p, fragmentIndex, ratio)
                            : [p],
                        ),
                      );
                      setFragmentIndex(0);
                    }}
                  >
                    <Scissors size={13} />
                    둘로 나누기
                  </button>
                </div>
                {active.fragments.length > 1 && (
                  <button
                    className="text-btn"
                    disabled={busy}
                    onClick={() => {
                      change(
                        pieces.flatMap((p) =>
                          p.id === active.id
                            ? p.fragments.map((f, i) => ({
                                ...p,
                                id: i === 0 ? p.id : crypto.randomUUID(),
                                name: `${p.name} · 영역 ${i + 1}`,
                                fragments: [f],
                              }))
                            : [p],
                        ),
                      );
                      setFragmentIndex(0);
                    }}
                  >
                    이어 붙인 영역을 각각 분리
                  </button>
                )}
                {active.warnings.length > 0 && (
                  <p className="warning">
                    {[...new Set(active.warnings)].join(" ")}
                  </p>
                )}
              </details>
            )}
          </div>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="review-footer">
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
            선택한 문제의 내용과 잘린 부분을 확인했어요.
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
              : `${includedPieces.filter((p) => p.kind !== "passage").length}문제${includedPieces.some((p) => p.kind === "passage") ? " + 공통 자료" : ""} 저장`}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
