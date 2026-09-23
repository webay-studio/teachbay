"use client";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent,
} from "react";
import { Hand, Maximize, ZoomIn, ZoomOut } from "lucide-react";

export const REVIEW_PAPER_WIDTH = 600;
const PREVIEW_WIDTH = 640;
const GAP = 64;
const BOARD_WIDTH = REVIEW_PAPER_WIDTH + GAP + PREVIEW_WIDTH;
type Camera = { x: number; y: number; scale: number };
const clampScale = (scale: number) => Math.max(0.25, Math.min(2.5, scale));

export function ReviewBoard({
  source,
  preview,
  aspect,
  hand,
  onHandChange,
}: {
  source: ReactNode;
  preview: ReactNode;
  aspect: number;
  hand: boolean;
  onHandChange: (value: boolean) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<Camera>({ x: 24, y: 32, scale: 1 });
  const [camera, setCamera] = useState(cameraRef.current);
  const [space, setSpace] = useState(false);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    camera: Camera;
  } | null>(null);
  function update(next: Camera) {
    cameraRef.current = next;
    setCamera(next);
  }
  function fit() {
    const el = viewport.current;
    if (!el) return;
    const mobile = el.clientWidth < 620;
    const width = mobile ? REVIEW_PAPER_WIDTH : BOARD_WIDTH;
    const scale = clampScale(
      Math.min(
        (el.clientWidth - 48) / width,
        mobile
          ? 1
          : (el.clientHeight - 100) / (REVIEW_PAPER_WIDTH / aspect + 32),
      ),
    );
    update({ x: (el.clientWidth - width * scale) / 2, y: 32, scale });
  }
  function zoomBy(factor: number, anchor?: { x: number; y: number }) {
    const el = viewport.current;
    if (!el) return;
    const current = cameraRef.current;
    const scale = clampScale(current.scale * factor);
    const point = anchor ?? { x: el.clientWidth / 2, y: el.clientHeight / 2 };
    const ratio = scale / current.scale;
    update({
      x: point.x - (point.x - current.x) * ratio,
      y: point.y - (point.y - current.y) * ratio,
      scale,
    });
  }
  function show(which: "source" | "preview") {
    const el = viewport.current;
    if (!el) return;
    const width = which === "source" ? REVIEW_PAPER_WIDTH : PREVIEW_WIDTH;
    const scale = clampScale(Math.min(1.25, (el.clientWidth - 64) / width));
    const offset = which === "source" ? 0 : REVIEW_PAPER_WIDTH + GAP;
    update({
      x: (el.clientWidth - width * scale) / 2 - offset * scale,
      y: 32,
      scale,
    });
  }
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    fit();
    return () => observer.disconnect();
  }, [aspect]);
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    function wheel(event: WheelEvent) {
      if (
        (event.target as HTMLElement).closest("textarea") &&
        !event.ctrlKey &&
        !event.metaKey
      )
        return;
      event.preventDefault();
      const box = el!.getBoundingClientRect();
      const unit =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? el!.clientHeight
            : 1;
      if (event.ctrlKey || event.metaKey) {
        zoomBy(Math.exp(-event.deltaY * unit * 0.01), {
          x: event.clientX - box.left,
          y: event.clientY - box.top,
        });
      } else {
        const current = cameraRef.current;
        update({
          ...current,
          x: current.x - (event.shiftKey ? event.deltaY : event.deltaX) * unit,
          y: current.y - (event.shiftKey ? 0 : event.deltaY) * unit,
        });
      }
    }
    const releaseSpace = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpace(false);
    };
    const blur = () => {
      setSpace(false);
      gesture.current = null;
      setDragging(false);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("keyup", releaseSpace);
    window.addEventListener("blur", blur);
    return () => {
      el.removeEventListener("wheel", wheel);
      window.removeEventListener("keyup", releaseSpace);
      window.removeEventListener("blur", blur);
    };
  }, []);
  function start(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.button !== 1) return;
    const target = event.target as HTMLElement;
    const onPaper = target.closest(".region-editor-canvas");
    if (event.button !== 1 && !hand && !space && onPaper) return;
    if (target.closest("a, input, select, textarea, [data-board-interactive]"))
      return;
    event.preventDefault();
    event.stopPropagation();
    viewport.current!.focus({ preventScroll: true });
    viewport.current!.setPointerCapture(event.pointerId);
    gesture.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      camera: cameraRef.current,
    };
    setDragging(true);
  }
  function end(event: PointerEvent<HTMLDivElement>) {
    if (gesture.current?.id !== event.pointerId) return;
    event.stopPropagation();
    gesture.current = null;
    setDragging(false);
    if (viewport.current?.hasPointerCapture(event.pointerId))
      viewport.current.releasePointerCapture(event.pointerId);
  }
  return (
    <div className="review-board">
      <div
        ref={viewport}
        className={`review-board-viewport ${hand || space ? "hand-mode" : ""} ${dragging ? "is-panning" : ""}`}
        tabIndex={0}
        role="group"
        aria-label="시험지와 미리보기 작업판"
        style={{
          backgroundPosition: `${camera.x}px ${camera.y}px`,
          backgroundSize: `${24 * camera.scale}px ${24 * camera.scale}px`,
        }}
        onPointerDownCapture={start}
        onPointerMoveCapture={(event) => {
          const current = gesture.current;
          if (!current || current.id !== event.pointerId) return;
          event.stopPropagation();
          update({
            ...current.camera,
            x: current.camera.x + event.clientX - current.x,
            y: current.camera.y + event.clientY - current.y,
          });
        }}
        onPointerUpCapture={end}
        onPointerCancelCapture={end}
        onLostPointerCapture={() => {
          gesture.current = null;
          setDragging(false);
        }}
        onKeyDownCapture={(event) => {
          if (
            event.code === "Space" &&
            !(event.target as HTMLElement).closest(
              "input, textarea, select, [data-board-interactive]",
            )
          ) {
            event.preventDefault();
            event.stopPropagation();
            setSpace(true);
          }
          if (event.key === "Escape" && (hand || space || gesture.current)) {
            event.preventDefault();
            event.stopPropagation();
            onHandChange(false);
            setSpace(false);
            gesture.current = null;
            setDragging(false);
          }
        }}
      >
        <div
          className="review-board-content"
          style={{
            transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`,
          }}
        >
          <section
            className="review-board-source"
            style={{ width: REVIEW_PAPER_WIDTH }}
            aria-label="원본 시험지"
          >
            <h4>원본 시험지</h4>
            {source}
          </section>
          <div
            className="review-board-preview"
            style={{ width: PREVIEW_WIDTH }}
          >
            {preview}
          </div>
        </div>
      </div>
      <div className="review-board-controls" aria-label="작업판 보기 도구">
        <button
          type="button"
          className="icon"
          aria-label="작업판 이동"
          title="작업판 이동 · Space + 드래그"
          aria-pressed={hand}
          onClick={() => onHandChange(!hand)}
        >
          <Hand size={16} />
        </button>
        <button
          type="button"
          className="text-btn"
          onClick={() => show("source")}
        >
          원본
        </button>
        <button
          type="button"
          className="text-btn"
          onClick={() => show("preview")}
        >
          미리보기
        </button>
        <span className="review-board-controls-divider" />
        <button
          type="button"
          className="icon"
          aria-label="작업판 축소"
          disabled={camera.scale <= 0.25}
          onClick={() => zoomBy(0.8)}
        >
          <ZoomOut size={16} />
        </button>
        <span className="review-board-scale" aria-live="polite">
          {Math.round(camera.scale * 100)}%
        </span>
        <button
          type="button"
          className="icon"
          aria-label="작업판 확대"
          disabled={camera.scale >= 2.5}
          onClick={() => zoomBy(1.25)}
        >
          <ZoomIn size={16} />
        </button>
        <button
          type="button"
          className="icon"
          aria-label="작업판 전체 보기"
          title="전체 보기"
          onClick={fit}
        >
          <Maximize size={16} />
        </button>
      </div>
    </div>
  );
}
