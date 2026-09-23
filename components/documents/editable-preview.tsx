"use client";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { useBlobUrl } from "../shared";
import type { DocumentPage, Piece, Rect } from "../../lib/documents/types";
import {
  simpleLatex,
  type EditableDraft,
  type EditableFragment,
  type EditableNode,
} from "../../lib/documents/editable-preview";
import { extractEditablePreview } from "../../lib/documents/extract-editable-preview";

function formula(value: string) {
  if (!value.trim()) return { html: "", error: false };
  try {
    return {
      html: katex.renderToString(value, {
        throwOnError: true,
        trust: false,
        strict: "error",
        maxExpand: 200,
        maxSize: 10,
      }),
      error: false,
    };
  } catch {
    return { html: "", error: true };
  }
}
function MathText({ value }: { value: string }) {
  const result = useMemo(() => formula(value), [value]);
  return result.error ? (
    <span className="editable-math-error">수식 확인</span>
  ) : (
    <span dangerouslySetInnerHTML={{ __html: result.html }} />
  );
}
function FittedContent({ node }: { node: EditableNode }) {
  const content = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = content.current,
      parent = el?.parentElement;
    if (!el || !parent) return;
    const fit = () =>
      setScale(
        Math.min(
          1,
          parent.clientWidth / Math.max(1, el.offsetWidth),
          parent.clientHeight / Math.max(1, el.offsetHeight),
        ),
      );
    const observer = new ResizeObserver(fit);
    observer.observe(parent);
    observer.observe(el);
    fit();
    return () => observer.disconnect();
  }, [node.mode, node.value]);
  return (
    <span
      ref={content}
      className="editable-node-content"
      style={{ transform: `scale(${scale})` }}
    >
      {node.mode === "text" ? node.value : <MathText value={node.value} />}
    </span>
  );
}
function FragmentLayer({
  fragment,
  selected,
  drawing,
  onSelect,
  onDraw,
}: {
  fragment: EditableFragment;
  selected?: string;
  drawing: boolean;
  onSelect: (id: string) => void;
  onDraw: (rect: Rect) => void;
}) {
  const url = useBlobUrl(fragment.blob);
  const start = useRef<{ x: number; y: number; id: number } | undefined>(
    undefined,
  );
  const [box, setBox] = useState<Rect>();
  function point(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.x) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.y) / bounds.height)),
    };
  }
  function drawn(event: PointerEvent<HTMLDivElement>) {
    const origin = start.current;
    if (!origin || origin.id !== event.pointerId) return;
    const end = point(event);
    return {
      x: Math.min(origin.x, end.x),
      y: Math.min(origin.y, end.y),
      w: Math.abs(end.x - origin.x),
      h: Math.abs(end.y - origin.y),
    };
  }
  const position = (r: Rect) => ({
    left: `${r.x * 100}%`,
    top: `${r.y * 100}%`,
    width: `${r.w * 100}%`,
    height: `${r.h * 100}%`,
  });
  return (
    <div
      className={`editable-fragment ${drawing ? "drawing" : ""}`}
      style={{ aspectRatio: `${fragment.width}/${fragment.height}` }}
      onPointerDown={(event) => {
        if (!drawing || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        start.current = { ...point(event), id: event.pointerId };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const rect = drawn(event);
        if (rect) setBox(rect);
      }}
      onPointerUp={(event) => {
        const rect = drawn(event);
        start.current = undefined;
        setBox(undefined);
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
        if (rect && rect.w > 0.01 && rect.h > 0.005) onDraw(rect);
      }}
      onPointerCancel={() => {
        start.current = undefined;
        setBox(undefined);
      }}
      onLostPointerCapture={() => {
        start.current = undefined;
        setBox(undefined);
      }}
    >
      <img
        src={url || undefined}
        alt="그림과 원래 배치를 보존한 문제 이미지"
        draggable={false}
      />
      {fragment.nodes.map((node, index) => (
        <button
          type="button"
          key={node.id}
          className={`editable-node ${node.mode} ${selected === node.id ? "selected" : ""}`}
          data-node-id={node.id}
          data-mode={node.mode}
          aria-label={`글자 영역 ${index + 1}`}
          aria-pressed={selected === node.id}
          style={{
            ...position(node.rect),
            fontSize: `${((node.rect.h * fragment.height) / fragment.width) * 90}cqw`,
          }}
          onClick={() => {
            if (!drawing) onSelect(node.id);
          }}
        >
          {(node.mode === "text" || node.mode === "math") && (
            <FittedContent node={node} />
          )}
        </button>
      ))}
      {box && <span className="editable-draw-box" style={position(box)} />}
    </div>
  );
}

export default function EditablePreview({
  piece,
  pages,
  cache,
  busy,
}: {
  piece: Piece;
  pages: DocumentPage[];
  cache: Map<string, EditableDraft>;
  busy: boolean;
}) {
  const signature = JSON.stringify([
    piece.fragments,
    piece.cleanPrint,
    pages.map((p) => p.asset.id),
  ]);
  const cached = cache.get(piece.id);
  const [draft, setDraft] = useState<EditableDraft | undefined>(() =>
    cached?.signature === signature ? cached : undefined,
  );
  const [history, setHistory] = useState<EditableDraft[]>([]);
  const [selection, setSelection] = useState<{
    fragment: number;
    id: string;
  }>();
  const [drawing, setDrawing] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const controller = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => controller.current?.abort(), []);
  const selected =
    selection &&
    draft?.fragments[selection.fragment]?.nodes.find(
      (n) => n.id === selection.id,
    );
  function change(next: EditableDraft) {
    if (draft) setHistory((items) => [...items.slice(-29), draft]);
    cache.set(piece.id, next);
    setDraft(next);
  }
  function patch(value: Partial<EditableNode>) {
    if (!draft || !selection) return;
    change({
      ...draft,
      fragments: draft.fragments.map((f, i) =>
        i === selection.fragment
          ? {
              ...f,
              nodes: f.nodes.map((n) =>
                n.id === selection.id ? { ...n, ...value } : n,
              ),
            }
          : f,
      ),
    });
  }
  async function extract() {
    const c = new AbortController();
    controller.current = c;
    setError("");
    setProgress("글자와 이미지 영역을 나누고 있어요.");
    try {
      const fragments: EditableFragment[] = [];
      for (const [index, fragment] of piece.fragments.entries()) {
        const page = pages.find((p) => p.id === fragment.pageId);
        if (!page) throw new Error("원본 페이지를 찾지 못했어요.");
        fragments.push(
          await extractEditablePreview(
            page,
            piece,
            index,
            c.signal,
            setProgress,
          ),
        );
      }
      if (c.signal.aborted) return;
      const next = { signature, fragments };
      cache.set(piece.id, next);
      setDraft(next);
    } catch (error) {
      if (!c.signal.aborted)
        setError(
          error instanceof Error
            ? error.message
            : "글자를 읽지 못했어요. 다시 시도해주세요.",
        );
    } finally {
      if (controller.current === c) {
        controller.current = undefined;
        setProgress("");
      }
    }
  }
  return (
    <div
      className="editable-preview"
      data-board-interactive="true"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          setDrawing(false);
          setSelection(undefined);
        }
      }}
    >
      <p className="editable-experiment-note">
        편집 실험 · 변경 내용은 저장에 반영되지 않아요.
      </p>
      {!draft && !progress && (
        <div className="editable-start">
          <p>글자를 나눠 수정하고, 그림은 원래 위치에 남겨둘게요.</p>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={extract}
          >
            글자 분리 시작
          </button>
        </div>
      )}
      {progress && (
        <div className="editable-start">
          <p role="status">{progress}</p>
          <button
            type="button"
            className="text-btn"
            onClick={() => controller.current?.abort()}
          >
            취소
          </button>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {draft && (
        <>
          <div className="editable-tools">
            <span>글자를 눌러 수정 · 불확실한 부분은 이미지 유지</span>
            <button
              type="button"
              className="text-btn"
              aria-pressed={drawing}
              onClick={() => setDrawing(!drawing)}
            >
              수식 영역 지정
            </button>
            <button
              type="button"
              className="text-btn"
              disabled={!history.length}
              onClick={() => {
                const previous = history.at(-1);
                if (!previous) return;
                setHistory((items) => items.slice(0, -1));
                cache.set(piece.id, previous);
                setDraft(previous);
              }}
            >
              편집 되돌리기
            </button>
          </div>
          {drawing && (
            <p className="editable-hint">
              바꿀 수식 위를 드래그한 뒤 수식을 입력하세요.
            </p>
          )}
          {draft.fragments.map((fragment, index) => (
            <FragmentLayer
              key={index}
              fragment={fragment}
              drawing={drawing}
              selected={
                selection?.fragment === index ? selection.id : undefined
              }
              onSelect={(id) => setSelection({ fragment: index, id })}
              onDraw={(rect) => {
                const id = crypto.randomUUID();
                // Keep the source visible until the user enters a replacement.
                const node: EditableNode = {
                  id,
                  rect,
                  original: "",
                  value: "",
                  mode: "image",
                  confidence: 0,
                };
                change({
                  ...draft,
                  fragments: draft.fragments.map((f, i) =>
                    i === index ? { ...f, nodes: [...f.nodes, node] } : f,
                  ),
                });
                setSelection({ fragment: index, id });
                setDrawing(false);
              }}
            />
          ))}
          {!draft.fragments.some((f) => f.nodes.length) && (
            <p className="editable-hint">
              확실한 글자 영역을 찾지 못했어요. 수식 영역을 직접 지정할 수
              있어요.
            </p>
          )}
          {selected && (
            <div className="editable-inspector">
              <div className="editable-modes" aria-label="영역 표시 방식">
                {(
                  [
                    ["image", "원본 이미지"],
                    ["text", "글자"],
                    ["math", "수식"],
                  ] as const
                ).map(([mode, title]) => (
                  <button
                    type="button"
                    className="text-btn"
                    key={mode}
                    aria-pressed={selected.mode === mode}
                    onClick={() =>
                      patch({
                        mode,
                        value:
                          mode === "math"
                            ? (simpleLatex(selected.value) ?? selected.value)
                            : selected.value,
                      })
                    }
                  >
                    {title}
                  </button>
                ))}
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => patch({ mode: "removed" })}
                >
                  영역 지우기
                </button>
                <button
                  type="button"
                  className="text-btn"
                  onClick={() =>
                    patch({ mode: "image", value: selected.original })
                  }
                >
                  원본 복원
                </button>
              </div>
              <textarea
                aria-label="선택 영역 내용"
                rows={3}
                maxLength={2000}
                value={selected.value}
                onChange={(event) =>
                  patch({
                    value: event.target.value,
                    mode: selected.mode === "math" ? "math" : "text",
                  })
                }
                placeholder="글자를 수정하거나, 수식 모드에서 LaTeX를 입력하세요."
              />
              {selected.mode === "math" && (
                <>
                  <p className="editable-hint">
                    {
                      "예: \\frac{1}{2}, \\sqrt{x}, x^{2} · 복잡한 수식은 직접 확인해주세요."
                    }
                  </p>
                  {formula(selected.value).error ? (
                    <p className="error" role="alert">
                      수식 표기를 확인해주세요. 괄호나 명령어가 맞지 않아요.
                    </p>
                  ) : (
                    <div className="editable-formula-result">
                      <MathText value={selected.value} />
                    </div>
                  )}
                </>
              )}
              {selected.original && (
                <p className="editable-hint">읽은 내용: {selected.original}</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
