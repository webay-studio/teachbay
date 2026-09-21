import type { TextLine } from "./base-types";
// Join PDF text runs on the same baseline, but never bridge a column gutter.
export function joinLines(runs: TextLine[]): TextLine[] {
  const sorted = runs
    .filter((r) => r.text.trim() && r.w > 0 && r.h > 0)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: TextLine[] = [];
  for (const run of sorted) {
    const line = lines.findLast(
      (l) =>
        Math.abs(l.y - run.y) < Math.min(l.h, run.h) * 0.55 &&
        run.x >= l.x &&
        run.x - (l.x + l.w) < 0.026,
    );
    if (line) {
      const right = Math.max(line.x + line.w, run.x + run.w);
      line.text += `${run.x - line.x - line.w > 0.002 ? " " : ""}${run.text}`;
      line.w = right - line.x;
      line.h = Math.max(line.h, run.h);
      line.confidence = Math.min(line.confidence ?? 100, run.confidence ?? 100);
    } else lines.push({ ...run });
  }
  return lines.sort((a, b) => a.y - b.y || a.x - b.x);
}
