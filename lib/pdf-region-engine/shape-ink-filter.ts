import { clusterPoints } from "./point-clusters";
import type { Rect, TextLine } from "./base-types";

export type ShapeDecision = {
  rect: Rect;
  action: "suppressed" | "classified" | "kept";
  classification: "suspected-handwriting" | "protected-print" | "unknown";
  reasons: string[];
  metrics: {
    points: number;
    heightSpread: number;
    irregular: number;
    alignment: number | null;
  };
  changedPixels: number;
};
export type ShapeInkReport = {
  algorithm: "isolated-irregular-ink-v1";
  status: "applied" | "insufficient-reference";
  referenceHeight: number;
  referenceLines: number;
  changedPixels: number;
  decisions: ShapeDecision[];
  excludedLineIds: string[];
  mode: "classify" | "erase";
  proposedPixels: number;
  parameters: { heightSpread: number; irregular: number; alignment: number };
};
const median = (ns: number[]) => {
  const sorted = [...ns].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};
const intersects = (a: Rect, b: Rect, px = 0, py = 0) =>
  a.x < b.x + b.w + px &&
  a.x + a.w > b.x - px &&
  a.y < b.y + b.h + py &&
  a.y + a.h > b.y - py;

/** Experimental geometry filter. No learned classifier, pixel dilation or inpainting.
 * Uses OCR only as positive protection: failed recognition is never enough to erase.
 * All coordinates and masks match the input canvas; source PDF remains untouched.
 */
export async function suppressIsolatedInk(
  canvas: HTMLCanvasElement,
  points: Rect[],
  lines: (TextLine & { id: string })[],
  signal: AbortSignal,
  flowRegions: Rect[] = [{ x: 0, y: 0, w: 1, h: 1 }],
  erase = false,
): Promise<{ report: ShapeInkReport; overlay: HTMLCanvasElement }> {
  const w = canvas.width,
    h = canvas.height;
  const overlay = document.createElement("canvas");
  overlay.width = w;
  overlay.height = h;
  const overlayContext = overlay.getContext("2d")!;
  const overlayPixels = overlayContext.createImageData(w, h);
  // Long, high-confidence prose establishes a page-specific reference, not fixed DPI.
  const references: TextLine[] = [];
  for (const line of lines) {
    if (
      line.y < 0.08 ||
      line.y > 0.9 ||
      /학교|학년도|고사|시험지|응시|유의/.test(line.text)
    )
      continue;
    if (
      (line.confidence ?? 0) < 80 ||
      (line.text.match(/[가-힣a-zA-Z]/g)?.length ?? 0) < 8
    )
      continue;
    if (
      !references.some(
        (r) => Math.abs(r.y - line.y) < line.h * 0.5 && intersects(r, line),
      )
    )
      references.push(line);
  }
  const referenceHeight = median(references.map((l) => l.h));
  const report: ShapeInkReport = {
    algorithm: "isolated-irregular-ink-v1",
    status: references.length >= 3 ? "applied" : "insufficient-reference",
    referenceHeight,
    referenceLines: references.length,
    changedPixels: 0,
    decisions: [],
    excludedLineIds: [],
    mode: erase ? "erase" : "classify",
    proposedPixels: 0,
    parameters: { heightSpread: 2.2, irregular: 0.25, alignment: 0.35 },
  };
  if (report.status !== "applied" || !referenceHeight)
    return { report, overlay };
  const hp = referenceHeight * h;
  // Preserve recognized print and math even when confidence is poor. A formula
  // resemblance is a veto, not proof that a line is printed.
  const protectedLines = lines.filter(
    (l) =>
      (l.confidence ?? 0) >= 65 ||
      /[=∫∑√≠≤≥①②③④⑤]|\b(?:sin|cos|tan|lim|log)\b|[가-힣]{2,}|\[\s*\d+\s*점/.test(
        l.text,
      ),
  );
  const protectedShapes = points.filter(
    (p) => p.h * h > hp * 4 || p.w * w > hp * 6,
  );
  const { clusters } = clusterPoints(
    points,
    h / w,
    Math.max(12, Math.min(28, (hp / w) * 1200 * 1.2)),
    5,
  );
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const frame = ctx.getImageData(0, 0, w, h);
  const removed = new Uint8Array(w * h);
  const visited = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  const ink = (at: number) =>
    frame.data[at * 4 + 3] > 0 &&
    Math.min(
      frame.data[at * 4],
      frame.data[at * 4 + 1],
      frame.data[at * 4 + 2],
    ) < 210;
  for (const cluster of clusters) {
    if (signal.aborted) throw new DOMException("취소되었습니다.", "AbortError");
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const rs = cluster.pointIds.map((id) => points[id]);
    const flow = flowRegions.find(
      (r) =>
        cluster.rect.x >= r.x && cluster.rect.x + cluster.rect.w <= r.x + r.w,
    );
    const localReferences = references.filter(
      (r) => flow && r.x >= flow.x && r.x + r.w <= flow.x + flow.w,
    );
    const localHeight = median(localReferences.map((r) => r.h));
    const hp = (localHeight || referenceHeight) * h;
    const heights = rs.map((r) => r.h * h).sort((a, b) => a - b);
    const q25 = heights[Math.floor(heights.length * 0.25)] || 1;
    const q75 = heights[Math.floor(heights.length * 0.75)] || 1;
    const heightSpread = q75 / q25;
    const irregular =
      rs.filter(
        (r) =>
          r.h * h > hp * 1.65 || (r.w * w > hp * 2.2 && r.h * h > hp * 0.8),
      ).length / rs.length;
    // Components sharing a baseline form rows; use actual pixel units on both axes.
    const aligned =
      rs.length > 150
        ? null
        : rs.filter(
            (r) =>
              rs.filter(
                (other) =>
                  other !== r &&
                  Math.abs(r.y + r.h - (other.y + other.h)) * h < hp * 0.18 &&
                  Math.abs(r.x + r.w / 2 - (other.x + other.w / 2)) * w <
                    hp * 5,
              ).length >= 2,
          ).length / rs.length;
    const rect = cluster.rect;
    const reasons: string[] = [];
    if (localReferences.length < 3)
      reasons.push("해당 읽기 영역의 본문 표본 부족");
    if (rs.length > 150 || rect.w > 0.4 || rect.h > 0.2)
      reasons.push("큰 군집: 본문·도형 혼합 가능성");
    if (
      protectedLines.some((l) =>
        intersects(rect, l, (hp / w) * 1.2, referenceHeight * 1.2),
      )
    )
      reasons.push("인식된 글자·수식과 겹치거나 가까움");
    if (
      protectedShapes.some((r) =>
        intersects(rect, r, (hp / w) * 0.5, referenceHeight * 0.5),
      )
    )
      reasons.push("표·그림·긴 획 가능성");
    if (
      heightSpread < 2.2 ||
      irregular < 0.25 ||
      (aligned !== null && aligned > 0.35)
    )
      reasons.push("필기 형태 근거 부족 또는 글줄 정렬 유지");
    const decision: ShapeDecision = {
      rect,
      action: "kept",
      classification: reasons.some((r) => /인식된|표·그림/.test(r))
        ? "protected-print"
        : "unknown",
      reasons,
      metrics: {
        points: rs.length,
        heightSpread,
        irregular,
        alignment: aligned,
      },
      changedPixels: 0,
    };
    report.decisions.push(decision);
    if (reasons.length) continue;
    // Erase only whole connected ink components enclosed by this candidate.
    // Never whiten its rectangle: nearby print and white answer spaces stay intact.
    const x0 = Math.max(0, Math.floor(rect.x * w)),
      y0 = Math.max(0, Math.floor(rect.y * h));
    const x1 = Math.min(w, Math.ceil((rect.x + rect.w) * w)),
      y1 = Math.min(h, Math.ceil((rect.y + rect.h) * h));
    for (let y = y0; y < y1; y++) {
      if ((y - y0) % 64 === 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        if (signal.aborted)
          throw new DOMException("취소되었습니다.", "AbortError");
      }
      for (let x = x0; x < x1; x++) {
        const start = y * w + x;
        if (visited[start] || !ink(start)) continue;
        let head = 0,
          tail = 1,
          boundary = false;
        queue[0] = start;
        visited[start] = 1;
        while (head < tail) {
          const at = queue[head++],
            xx = at % w,
            yy = Math.floor(at / w);
          if (xx === x0 || xx === x1 - 1 || yy === y0 || yy === y1 - 1)
            boundary = true;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const nx = xx + dx,
                ny = yy + dy;
              if (nx < x0 || nx >= x1 || ny < y0 || ny >= y1) continue;
              const next = ny * w + nx;
              if (!visited[next] && ink(next)) {
                visited[next] = 1;
                queue[tail++] = next;
              }
            }
        }
        if (boundary) continue;
        for (let i = 0; i < tail; i++) {
          const at = queue[i];
          removed[at] = 1;
          overlayPixels.data.set([235, 45, 115, 210], at * 4);
        }
        decision.changedPixels += tail;
      }
    }
    decision.action = decision.changedPixels
      ? erase
        ? "suppressed"
        : "classified"
      : "kept";
    if (decision.changedPixels)
      decision.classification = "suspected-handwriting";
    decision.reasons.push(
      decision.changedPixels
        ? "본문과 분리됨 · 크기 편차·불규칙한 형태·글줄 불일치 동시 충족 (추정)"
        : "경계에 닿은 획 유지: 안전하게 분리하지 못함",
    );
    report.changedPixels += decision.changedPixels;
  }
  report.proposedPixels = report.changedPixels;
  if (!erase) {
    report.changedPixels = 0;
    report.decisions.forEach((d) => {
      d.changedPixels = 0;
    });
    overlayContext.putImageData(overlayPixels, 0, 0);
    return { report, overlay };
  }
  // Suppress OCR evidence only if virtually all of its ink was actually removed.
  // Retain mixed lines rather than infer missing text or perform another OCR pass.
  for (const line of report.changedPixels ? lines : []) {
    if (signal.aborted) throw new DOMException("취소되었습니다.", "AbortError");
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    let total = 0,
      count = 0;
    for (
      let y = Math.max(0, Math.floor(line.y * h));
      y < Math.min(h, Math.ceil((line.y + line.h) * h));
      y++
    )
      for (
        let x = Math.max(0, Math.floor(line.x * w));
        x < Math.min(w, Math.ceil((line.x + line.w) * w));
        x++
      ) {
        const at = y * w + x;
        if (ink(at)) {
          total++;
          if (removed[at]) count++;
        }
      }
    if (total > 0 && count / total >= 0.95)
      report.excludedLineIds.push(line.id);
  }
  for (let at = 0; at < removed.length; at++)
    if (removed[at])
      frame.data[at * 4] =
        frame.data[at * 4 + 1] =
        frame.data[at * 4 + 2] =
          255;
  if (signal.aborted) throw new DOMException("취소되었습니다.", "AbortError");
  ctx.putImageData(frame, 0, 0);
  overlayContext.putImageData(overlayPixels, 0, 0);
  return { report, overlay };
}
