import type { Rect } from "./base-types";
import type { EvidenceLine } from "./structure";
import type { ContentBlock, FlowRegion } from "./question-regions";
import type { ShapeInkReport } from "./shape-ink-filter";
export const overlap = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
export const union = (rs: Rect[]): Rect => {
  const x = Math.min(...rs.map((r) => r.x)),
    y = Math.min(...rs.map((r) => r.y));
  return {
    x,
    y,
    w: Math.max(...rs.map((r) => r.x + r.w)) - x,
    h: Math.max(...rs.map((r) => r.y + r.h)) - y,
  };
};
export const isMaterial = (s: string) =>
  /\[\s*\d+\s*[~～–-]\s*\d+\s*\]|다음\s*(글|지문).*읽|read.*passage/i.test(s);
export const isOption = (s: string) => /[①②③④⑤⑥⑦⑧⑨⑩]|^\s*[A-E][.)]/.test(s);
export const isFormula = (s: string) =>
  /[=∫∑√≤≥]|\b(?:sin|cos|tan|lim|log)\b/.test(s);
export function buildBlocks(
  flow: FlowRegion,
  lines: EvidenceLine[],
  points: Rect[],
  aspect: number,
  lineHeight: number,
  shape?: ShapeInkReport,
  visuals: Rect[] = [],
): ContentBlock[] {
  const blocks: ContentBlock[] = [],
    used = new Set<number>();
  const belongs = (r: Rect) =>
    r.x >= flow.rect.x - 0.002 &&
    r.x + r.w <= flow.rect.x + flow.rect.w + 0.002 &&
    r.y >= flow.rect.y &&
    r.y + r.h <= flow.rect.y + flow.rect.h;
  const members = points
    .map((rect, id) => ({ rect, id }))
    .filter((p) => belongs(p.rect));
  const body = lines.filter((l) => l.role !== "margin");
  for (const line of body) {
    // Duplicate OCR readings still share the same physical ink support. A component
    // assigned to an earlier reading must not make this reading fall back to an
    // unsupported, larger OCR bbox (which can cross a new passage heading).
    const matching = members.filter(
      (p) => overlap(p.rect, line) > 0.25 * p.rect.w * p.rect.h,
    );
    matching.forEach((p) => used.add(p.id));
    // OCR rows spanning unrelated ink are bounded by their supported components.
    const rect =
      line.source === "pdf"
        ? union([line, ...matching.map((p) => p.rect)])
        : matching.length
          ? union(matching.map((p) => p.rect))
          : line;
    blocks.push({
      id: `block-${line.id}`,
      pageIndex: flow.pageIndex,
      flowRegionId: flow.id,
      rect,
      text: line.text,
      lineIds: [line.id],
      componentIds: matching.map((p) => p.id),
      role: isMaterial(line.text)
        ? "material"
        : isOption(line.text)
          ? "option"
          : isFormula(line.text)
            ? "formula"
            : "text",
      classification: line.source === "pdf" ? "protected-print" : "unknown",
    });
  }
  const pending = members.filter(
    (p) =>
      !used.has(p.id) &&
      !lines.some((l) => l.role === "margin" && overlap(p.rect, l) > 0),
  );
  // Build small local line/formula blocks by box-edge gaps, never a transitive page cluster.
  const hx = lineHeight * aspect;
  for (const p of pending.sort(
    (a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x,
  )) {
    // Tiny punctuation remains in raw observations. Attach only near existing print;
    // do not create thousands of independent noise blocks from scanner speckles.
    if (
      (p.rect.pixelCount ?? 8) < 8 &&
      !blocks.some(
        (b) =>
          (b.text || b.role === "formula") &&
          overlap(p.rect, {
            x: b.rect.x - hx * 0.6,
            y: b.rect.y - lineHeight * 0.4,
            w: b.rect.w + hx * 1.2,
            h: b.rect.h + lineHeight * 0.8,
          }) > 0,
      )
    )
      continue;
    const match = blocks.find((b) => {
      const dx = Math.max(
        0,
        b.rect.x - p.rect.x - p.rect.w,
        p.rect.x - b.rect.x - b.rect.w,
      );
      const dy = Math.max(
        0,
        b.rect.y - p.rect.y - p.rect.h,
        p.rect.y - b.rect.y - b.rect.h,
      );
      const yOverlap = Math.max(
        0,
        Math.min(b.rect.y + b.rect.h, p.rect.y + p.rect.h) -
          Math.max(b.rect.y, p.rect.y),
      );
      const xOverlap = Math.max(
        0,
        Math.min(b.rect.x + b.rect.w, p.rect.x + p.rect.w) -
          Math.max(b.rect.x, p.rect.x),
      );
      const enclosed =
        overlap(b.rect, p.rect) >=
        Math.min(b.rect.w * b.rect.h, p.rect.w * p.rect.h) * 0.95;
      if (
        enclosed &&
        p.rect.w < flow.rect.w * 0.95 &&
        p.rect.h < flow.rect.h * 0.9
      )
        return true;
      const merged = union([b.rect, p.rect]);
      if (merged.h > lineHeight * 2.8) return false;
      return (
        (dx < hx * 0.6 && yOverlap > Math.min(b.rect.h, p.rect.h) * 0.3) ||
        (dy < lineHeight * 0.2 && xOverlap > Math.min(b.rect.w, p.rect.w) * 0.6)
      );
    });
    if (match) {
      match.rect = union([match.rect, p.rect]);
      match.componentIds.push(p.id);
      if (p.rect.h > lineHeight * 2)
        match.role = match.role === "option" ? "option" : "visual";
    } else
      blocks.push({
        id: `ink-${flow.id}-${p.id}`,
        pageIndex: flow.pageIndex,
        flowRegionId: flow.id,
        rect: p.rect,
        text: "",
        lineIds: [],
        componentIds: [p.id],
        role:
          p.rect.h > lineHeight * 2 || p.rect.w > hx * 4 ? "visual" : "unknown",
        classification: "unknown",
      });
  }
  for (const [index, r] of visuals.entries())
    if (belongs(r))
      blocks.push({
        id: `pdf-visual-${flow.id}-${index}`,
        pageIndex: flow.pageIndex,
        flowRegionId: flow.id,
        rect: r,
        text: "",
        lineIds: [],
        componentIds: [],
        role: "visual",
        classification: "protected-print",
      });
  // A circled option and its nearby drawing become an option block. Preserve row/column reading order.
  for (const option of blocks.filter((b) => b.role === "option"))
    for (const graphic of blocks.filter(
      (b) => b.role === "visual" && b !== option,
    )) {
      const dx = Math.max(
        0,
        graphic.rect.x - option.rect.x - option.rect.w,
        option.rect.x - graphic.rect.x - graphic.rect.w,
      );
      const dy = Math.max(
        0,
        graphic.rect.y - option.rect.y - option.rect.h,
        option.rect.y - graphic.rect.y - graphic.rect.h,
      );
      if (
        dx < hx * 1.5 &&
        dy < lineHeight * 0.6 &&
        graphic.rect.w < flow.rect.w * 0.55
      ) {
        option.rect = union([option.rect, graphic.rect]);
        option.componentIds.push(...graphic.componentIds);
        graphic.componentIds = [];
        graphic.lineIds = [];
        graphic.role = "unknown";
      }
    }
  for (const block of blocks) {
    if (block.classification === "protected-print") continue;
    const suspicious = shape?.decisions.some(
      (d) =>
        d.classification === "suspected-handwriting" &&
        overlap(block.rect, d.rect) > 0.6 * block.rect.w * block.rect.h,
    );
    if (suspicious) block.classification = "suspected-handwriting";
  }
  return blocks
    .filter(
      (b) => b.componentIds.length || b.lineIds.length || b.role === "visual",
    )
    .sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
}
