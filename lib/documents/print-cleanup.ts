import type { DocumentPage, Piece, Rect, TextLine } from "./types";

export type PrintToken = TextLine & { group?: string };
const compact = (s: string) => s.normalize("NFKC").replace(/\s/g, "");
export function intersectRect(a: Rect, b: Rect): Rect | undefined {
  const x = Math.max(a.x, b.x),
    y = Math.max(a.y, b.y);
  const w = Math.min(a.x + a.w, b.x + b.w) - x;
  const h = Math.min(a.y + a.h, b.y + b.h) - y;
  return w > 0 && h > 0 ? { x, y, w, h } : undefined;
}
const bounds = (tokens: Rect[]): Rect => {
  const x = Math.min(...tokens.map((t) => t.x)),
    y = Math.min(...tokens.map((t) => t.y));
  return {
    x,
    y,
    w: Math.max(...tokens.map((t) => t.x + t.w)) - x,
    h: Math.max(...tokens.map((t) => t.y + t.h)) - y,
  };
};

/** Only whole, located tokens are erased. Never estimate substring widths. */
export function automaticPrintErasures(
  page: DocumentPage,
  piece: Piece,
  index: number,
): Rect[] {
  if (piece.kind !== "question" || piece.cleanPrint === false) return [];
  const region = piece.fragments[index].rect;
  const tokens: PrintToken[] = [
    ...(page.printTokens ?? []),
    // OCR can split brackets and digits into boxes with different baselines.
    // A complete label-only line is still an exact, safe located token.
    ...page.lines.map((line, i) => ({ ...line, group: `whole-line-${i}` })),
  ].filter(
    (t) =>
      (t.confidence ?? 100) >= 80 &&
      t.w > 0 &&
      t.h > 0 &&
      t.x >= region.x - 0.002 &&
      t.y >= region.y - 0.002 &&
      t.x + t.w <= region.x + region.w + 0.002 &&
      t.y + t.h <= region.y + region.h + 0.002,
  );
  const number = compact(
    piece.originalLabel ?? String(piece.number ?? ""),
  ).replace(/[.번]$/, "");
  const firstLineY = Math.min(...tokens.map((t) => t.y));
  const found: Rect[] = [];
  for (const token of tokens) {
    // Join split PDF glyphs / OCR words only within one pass and one baseline.
    const row = tokens
      .filter(
        (t) =>
          (t.group ?? "") === (token.group ?? "") &&
          t.x >= token.x &&
          Math.abs(t.y + t.h / 2 - token.y - token.h / 2) <
            Math.min(t.h, token.h) * 0.4,
      )
      .sort((a, b) => a.x - b.x);
    const chain: PrintToken[] = [];
    for (const next of row.slice(0, 7)) {
      const previous = chain.at(-1);
      if (
        previous &&
        (next.x < previous.x + previous.w - 0.001 ||
          (next.x - previous.x - previous.w) * page.asset.width >
            token.h * page.asset.height * 0.65)
      )
        break;
      chain.push(next);
      const text = compact(chain.map((t) => t.text).join(""));
      const rect = bounds(chain);
      const score = /^(?:\[\d{1,2}(?:\.\d)?점\]|\(\d{1,2}(?:\.\d)?점\))$/.test(
        text,
      );
      const marker =
        index === 0 &&
        number &&
        (/^(?:\d{1,3}[.、번]|\[\d{1,3}\])$/.test(text) ||
          (piece.fragments[index].numberOnly && /^\d{1,3}$/.test(text))) &&
        text.replace(/[.、번\[\]]/g, "") === number &&
        rect.x - region.x < Math.min(0.045, region.w * 0.15) &&
        rect.y - firstLineY < token.h * 0.5;
      if (!score && !marker) continue;
      // Geometry sanity: no full sentence / math block can become an erasure.
      if (
        rect.w * page.asset.width >
        rect.h * page.asset.height * (score ? 7 : 3)
      )
        continue;
      // OCR boxes can omit antialiased bracket edges. Pad by glyph height,
      // stopping at adjacent recognized content instead of clipping the page.
      const px =
        Math.max(1, rect.h * page.asset.height * 0.18) / page.asset.width;
      const py =
        Math.max(1, rect.h * page.asset.height * 0.08) / page.asset.height;
      let left = rect.x - px,
        right = rect.x + rect.w + px;
      let top = rect.y - py,
        bottom = rect.y + rect.h + py;
      for (const other of tokens) {
        if (other.y < rect.y + rect.h && other.y + other.h > rect.y) {
          if (other.x >= rect.x + rect.w - 1e-9)
            right = Math.min(right, other.x);
          if (other.x + other.w <= rect.x + 1e-9)
            left = Math.max(left, other.x + other.w);
        }
        if (other.x < rect.x + rect.w && other.x + other.w > rect.x) {
          if (other.y >= rect.y + rect.h - 1e-9)
            bottom = Math.min(bottom, other.y);
          if (other.y + other.h <= rect.y + 1e-9)
            top = Math.max(top, other.y + other.h);
        }
      }
      const padded = intersectRect(
        { x: left, y: top, w: right - left, h: bottom - top },
        region,
      );
      if (padded) found.push(padded);
      // Continue: a split number and period must both be removed.
    }
  }
  return found.filter(
    (a, i) =>
      !found.some(
        (b, j) =>
          j !== i &&
          a.x >= b.x &&
          a.y >= b.y &&
          a.x + a.w <= b.x + b.w &&
          a.y + a.h <= b.y + b.h &&
          (b.w * b.h > a.w * a.h || j < i),
      ),
  );
}

export function fragmentErasures(
  page: DocumentPage,
  piece: Piece,
  index: number,
): Rect[] {
  return [
    ...automaticPrintErasures(page, piece, index),
    ...(piece.fragments[index].erasures ?? []),
  ].flatMap((r) => {
    const clipped = intersectRect(r, piece.fragments[index].rect);
    return clipped ? [clipped] : [];
  });
}
