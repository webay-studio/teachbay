"use client";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type KeyboardEvent,
} from "react";
import type { DocumentPage, Piece, Rect } from "../../lib/documents/types";
import {
  drawRegion,
  moveRegion,
  resizeRegion,
  REGION_HANDLES,
  type ResizeHandle,
} from "../../lib/documents/region-edit";
import { fragmentErasures } from "../../lib/documents/print-cleanup";
import { useBlobUrl } from "../shared";

type Gesture = {
  pointerId: number;
  start: { x: number; y: number };
  client: { x: number; y: number };
  initial: Rect;
  preview: Rect;
  piece?: Piece;
  fragmentIndex: number;
  handle?: ResizeHandle;
  moved: boolean;
};
const handleNames: Record<ResizeHandle, string> = {
  n: "위",
  ne: "오른쪽 위",
  e: "오른쪽",
  se: "오른쪽 아래",
  s: "아래",
  sw: "왼쪽 아래",
  w: "왼쪽",
  nw: "왼쪽 위",
};

export function RegionCanvas({
  page,
  pieces,
  activeId,
  fragmentIndex,
  mode,
  width,
  busy,
  label,
  onSelect,
  onChange,
  onDraw,
  onCancel,
  onDelete,
  onUndo,
}: {
  page: DocumentPage;
  pieces: Piece[];
  activeId?: string;
  fragmentIndex: number;
  mode: "select" | "new" | "erase";
  width: number;
  busy: boolean;
  label: (piece: Piece) => string;
  onSelect: (piece: Piece, index: number) => void;
  onChange: (piece: Piece, index: number, rect: Rect) => void;
  onDraw: (rect: Rect) => void;
  onCancel: () => void;
  onDelete: () => void;
  onUndo: () => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | undefined>(undefined);
  const [preview, setPreview] = useState<Gesture>();
  const url = useBlobUrl(page.asset.blob);
  function cancel() {
    gesture.current = undefined;
    setPreview(undefined);
  }
  useEffect(() => {
    cancel();
  }, [page.id, mode, busy]);
  function point(e: PointerEvent) {
    const box = stage.current!.getBoundingClientRect();
    return {
      x: (e.clientX - box.left) / box.width,
      y: (e.clientY - box.top) / box.height,
    };
  }
  function start(
    e: PointerEvent,
    piece?: Piece,
    index = 0,
    handle?: ResizeHandle,
  ) {
    if (busy || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (piece) onSelect(piece, index);
    stage.current!.focus({ preventScroll: true });
    stage.current!.setPointerCapture(e.pointerId);
    const origin = point(e);
    const rect = piece?.fragments[index].rect ?? { ...origin, w: 0, h: 0 };
    gesture.current = {
      pointerId: e.pointerId,
      start: origin,
      client: { x: e.clientX, y: e.clientY },
      initial: rect,
      preview: rect,
      piece,
      fragmentIndex: index,
      handle,
      moved: false,
    };
    setPreview(gesture.current);
  }
  function update(e: PointerEvent) {
    const current = gesture.current;
    if (!current || current.pointerId !== e.pointerId) return;
    const end = point(e),
      dx = end.x - current.start.x,
      dy = end.y - current.start.y;
    const rect = !current.piece
      ? drawRegion(current.start, end)
      : current.handle
        ? resizeRegion(current.initial, current.handle, dx, dy)
        : moveRegion(current.initial, dx, dy);
    const next = {
      ...current,
      preview: rect,
      moved:
        current.moved ||
        Math.hypot(e.clientX - current.client.x, e.clientY - current.client.y) >
          3,
    };
    gesture.current = next;
    setPreview(next);
    return next;
  }
  function finish(e: PointerEvent) {
    const current = update(e);
    cancel();
    if (stage.current?.hasPointerCapture(e.pointerId))
      stage.current.releasePointerCapture(e.pointerId);
    if (!current?.moved) return;
    if (current.piece)
      onChange(current.piece, current.fragmentIndex, current.preview);
    else if (
      current.preview.w >= (mode === "erase" ? 0.001 : 0.01) &&
      current.preview.h >= (mode === "erase" ? 0.001 : 0.005)
    )
      onDraw(current.preview);
  }
  function keyboard(e: KeyboardEvent) {
    if (busy) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cancel();
      onCancel();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      cancel();
      onUndo();
      return;
    }
    const piece = pieces.find((p) => p.id === activeId);
    if (!piece || piece.fragments[fragmentIndex]?.pageId !== page.id) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      onDelete();
      return;
    }
    const direction = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }[e.key];
    if (!direction) return;
    e.preventDefault();
    const step = e.shiftKey ? 0.01 : 0.002;
    const handle = (e.target as HTMLElement).dataset.handle as
      ResizeHandle | undefined;
    const rect = piece.fragments[fragmentIndex].rect;
    onChange(
      piece,
      fragmentIndex,
      handle
        ? resizeRegion(rect, handle, direction[0] * step, direction[1] * step)
        : moveRegion(rect, direction[0] * step, direction[1] * step),
    );
  }
  return (
    <div className="source-canvas-scroll">
      <div
        ref={stage}
        tabIndex={0}
        role="group"
        aria-label="원본 영역 편집기"
        className={`source-stage region-editor-canvas ${mode !== "select" ? "drawing" : ""}`}
        style={{
          width: `${width}px`,
          maxWidth: "none",
        }}
        onPointerDown={(e) => start(e)}
        onPointerMove={update}
        onPointerUp={finish}
        onPointerCancel={cancel}
        onLostPointerCapture={cancel}
        onKeyDown={keyboard}
      >
        <img
          src={url || undefined}
          alt={`${page.index + 1}쪽 원본 문서`}
          draggable={false}
        />
        {pieces.flatMap((piece) =>
          piece.fragments.map((fragment, index) => {
            if (fragment.pageId !== page.id) return null;
            const active = piece.id === activeId && index === fragmentIndex;
            const rect =
              preview?.piece?.id === piece.id && preview.fragmentIndex === index
                ? preview.preview
                : fragment.rect;
            return (
              <div
                key={`${piece.id}-${index}`}
                data-piece-id={piece.id}
                data-fragment-index={index}
                className={`region-overlay ${active ? "active" : ""} ${piece.kind === "passage" ? "passage" : ""}`}
                style={{
                  left: `${rect.x * 100}%`,
                  top: `${rect.y * 100}%`,
                  width: `${rect.w * 100}%`,
                  height: `${rect.h * 100}%`,
                }}
              >
                <button
                  type="button"
                  className="region-body"
                  disabled={busy || mode !== "select"}
                  aria-label={`${piece.name}, ${index + 1}번째 영역 선택`}
                  aria-pressed={active}
                  onPointerDown={(e) => start(e, piece, index)}
                  onClick={(e) => {
                    if (e.detail === 0) onSelect(piece, index);
                  }}
                >
                  <span className="region-caption">
                    {piece.kind === "passage"
                      ? active
                        ? "공통 지문"
                        : `지문 ${label(piece)}`
                      : active
                        ? `문제 ${label(piece)}`
                        : label(piece)}
                  </span>
                </button>
                {active &&
                  mode === "select" &&
                  !busy &&
                  REGION_HANDLES.map((handle) => (
                    <button
                      type="button"
                      key={handle}
                      className={`region-handle handle-${handle}`}
                      data-handle={handle}
                      aria-label={`${handleNames[handle]} 크기 조절`}
                      onPointerDown={(e) => start(e, piece, index, handle)}
                    />
                  ))}
              </div>
            );
          }),
        )}
        {pieces
          .filter((p) => p.id === activeId)
          .flatMap((piece) =>
            piece.fragments.flatMap((f, index) =>
              f.pageId === page.id
                ? fragmentErasures(page, piece, index).map((mask, i) => (
                    <div
                      key={`erase-${index}-${i}`}
                      className="source-erasure"
                      style={{
                        left: `${mask.x * 100}%`,
                        top: `${mask.y * 100}%`,
                        width: `${mask.w * 100}%`,
                        height: `${mask.h * 100}%`,
                      }}
                    />
                  ))
                : [],
            ),
          )}
        {preview && !preview.piece && (
          <div
            className="draw-region"
            style={{
              left: `${preview.preview.x * 100}%`,
              top: `${preview.preview.y * 100}%`,
              width: `${preview.preview.w * 100}%`,
              height: `${preview.preview.h * 100}%`,
            }}
          />
        )}
      </div>
    </div>
  );
}
