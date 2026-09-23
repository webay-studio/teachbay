import type { Rect, TextLine } from "./types";
import { intersectRect } from "./print-cleanup";

export type EditableNode = {
  id: string;
  rect: Rect;
  original: string;
  value: string;
  mode: "text" | "math" | "image" | "removed";
  confidence: number;
};
export type EditableFragment = {
  blob: Blob;
  width: number;
  height: number;
  nodes: EditableNode[];
  source: "pdf" | "ocr";
};
export type EditableDraft = {
  signature: string;
  fragments: EditableFragment[];
};

/** Convert only explicit linear symbols. Never guess a fraction/root's spatial scope. */
export function simpleLatex(text: string): string | undefined {
  const input = text.trim();
  if (!input || !/[=+−×÷±≤≥≠∞παβθ²³⁰¹⁴⁵⁶⁷⁸⁹]/u.test(input)) return;
  if (!/^[a-zA-Z0-9\s.,()+\-=−×÷±≤≥≠∞παβθ²³⁰¹⁴⁵⁶⁷⁸⁹]+$/u.test(input)) return;
  const symbols: Record<string, string> = {
    "−": "-",
    "×": "\\times ",
    "÷": "\\div ",
    "±": "\\pm ",
    "≤": "\\le ",
    "≥": "\\ge ",
    "≠": "\\ne ",
    "∞": "\\infty ",
    π: "\\pi ",
    α: "\\alpha ",
    β: "\\beta ",
    θ: "\\theta ",
  };
  return input
    .replace(
      /[⁰¹²³⁴⁵⁶⁷⁸⁹]+/gu,
      (s) => `^{${[...s].map((c) => "⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(c)).join("")}}`,
    )
    .replace(/[−×÷±≤≥≠∞παβθ]/gu, (c) => symbols[c]);
}

/** One bounded, non-overlapping layer. Rejected text remains in the original raster. */
export function editableNodes(
  tokens: TextLine[],
  crop: Rect,
  erasures: Rect[] = [],
): EditableNode[] {
  const candidates = tokens
    .filter((t) => {
      if (![t.x, t.y, t.w, t.h].every(Number.isFinite) || t.w <= 0 || t.h <= 0)
        return false;
      if (!t.text.trim() || t.text.length > 1000) return false;
      if (
        t.x < crop.x ||
        t.y < crop.y ||
        t.x + t.w > crop.x + crop.w + 1e-6 ||
        t.y + t.h > crop.y + crop.h + 1e-6
      )
        return false;
      return !erasures.some((mask) => intersectRect(t, mask));
    })
    .sort(
      (a, b) =>
        (b.confidence ?? 100) - (a.confidence ?? 100) || a.w * a.h - b.w * b.h,
    );
  const accepted: TextLine[] = [];
  for (const token of candidates) {
    if (accepted.length >= 300) break;
    if (
      accepted.some((other) => {
        const overlap = intersectRect(token, other);
        return (
          overlap &&
          overlap.w * overlap.h >
            Math.min(token.w * token.h, other.w * other.h) * 0.15
        );
      })
    )
      continue;
    accepted.push(token);
  }
  return accepted
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((t, index) => {
      const confidence = t.confidence ?? 100;
      const value = t.text.trim();
      const math = simpleLatex(value);
      const plain =
        /(?:[가-힣]{2,}|[a-zA-Z]{3,})/.test(value) &&
        /^[\p{L}\p{N}\s.,!?;:'"“”‘’()\-·]+$/u.test(value) &&
        !/[\uE000-\uF8FF\uFFFD]/u.test(value);
      const mode =
        confidence >= 90 ? (math ? "math" : plain ? "text" : "image") : "image";
      return {
        id: `text-${index}`,
        rect: {
          x: (t.x - crop.x) / crop.w,
          y: (t.y - crop.y) / crop.h,
          w: t.w / crop.w,
          h: t.h / crop.h,
        },
        original: value,
        value: mode === "math" ? math! : value,
        mode,
        confidence,
      };
    });
}
