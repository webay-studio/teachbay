import type { EvidenceLine } from "./structure";
import type { Rect } from "./base-types";
/** Bounded proposals for number-line re-reading; these are not question anchors. */
export function numberRetryCrops(
  lines: EvidenceLine[],
  flows: Rect[],
  limit = 8,
): Rect[] {
  const out: Rect[] = [];
  for (const flow of flows) {
    const prose = lines.filter(
      (l) =>
        l.x >= flow.x &&
        l.x < flow.x + flow.w * 0.18 &&
        l.w < flow.w * 1.08 &&
        l.h < 0.045 &&
        (l.text.match(/[가-힣]/g)?.length ?? 0) >= 4 &&
        !/학교|학년도|시험지|고사|학기|학년|저작권|배포|교시/.test(l.text),
    );
    if (!prose.length) continue;
    const numbered = prose.filter((l) =>
      /^\s*(?:\[?서술형\s*)?\d{1,3}/.test(l.text),
    );
    const starts = (numbered.length ? numbered : prose)
      .map((l) => l.x)
      .sort((a, b) => a - b);
    const left = starts[Math.floor(starts.length * 0.25)];
    const candidates = prose
      .filter((l) => l.x <= left + Math.max(0.014, l.h * 0.8))
      .sort((a, b) => a.y - b.y);
    for (const l of candidates) {
      // Different OCR passes at one location form one retry, not independent votes.
      if (
        out.some(
          (r) =>
            Math.abs(r.x - flow.x) < 0.005 &&
            Math.abs(r.y + 0.01 - l.y) < Math.max(0.006, l.h * 0.5),
        )
      )
        continue;
      const top = Math.max(flow.y, l.y - 0.01),
        bottom = Math.min(flow.y + flow.h, l.y + l.h + 0.012);
      out.push({ x: flow.x, y: top, w: flow.w, h: bottom - top });
      if (out.length >= limit) return out;
    }
  }
  return out;
}
