import type { Rect, TextLine } from "./base-types";
/** Analysis-only neutral-channel image: source pixels are never edited. */
export function neutralPixels(data: Uint8ClampedArray) {
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.max(data[i], data[i + 1], data[i + 2]);
    const x = Math.max(0, Math.min(255, ((v - 90) * 255) / 145));
    out[i] = out[i + 1] = out[i + 2] = x;
    out[i + 3] = 255;
  }
  return out;
}
/** Long vertical rules are layout proposals, never question boundaries. */
export function physicalRegions(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Rect[] {
  const scores: number[] = [],
    continuous = new Set<number>(),
    step = Math.max(1, Math.floor(height / 900));
  for (let x = 0; x < width; x += 2) {
    let hit = 0,
      run = 0,
      gap = 0,
      longest = 0;
    for (let y = Math.floor(height * 0.08); y < height * 0.97; y += step) {
      let ink = false;
      for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= width) continue;
        const k = (y * width + xx) * 4;
        if (Math.max(data[k], data[k + 1], data[k + 2]) < 160) {
          ink = true;
          break;
        }
      }
      if (ink) {
        hit++;
        run += gap + step;
        gap = 0;
        longest = Math.max(longest, run);
      } else {
        gap += step;
        // Tolerate small scan gaps, but never join separate paragraph/box edges.
        if (gap > Math.max(step, height * 0.005)) run = gap = 0;
      }
    }
    if (hit * step > height * 0.4) scores.push(x);
    if (longest > height * 0.4) continuous.add(x);
  }
  const clusters: number[][] = [];
  for (const x of scores) {
    if (!clusters.length || x - clusters.at(-1)!.at(-1)! > width * 0.015)
      clusters.push([x]);
    else clusters.at(-1)!.push(x);
  }
  const lines = clusters
    .map((c) => c[Math.floor(c.length / 2)] / width)
    .filter((x) => x > 0.02 && x < 0.98);
  const middle = lines
    .filter((x) => x > 0.3 && x < 0.7)
    .sort((a, b) => Math.abs(a - 0.5) - Math.abs(b - 0.5))[0];
  if (middle !== undefined) {
    // Projection peaks suffice for a divider proposal. Outer edges are harder
    // barriers: require a genuinely long rule before excluding page content.
    const outerLines = clusters
      .filter((c) => c.some((x) => continuous.has(x)))
      .map((c) => c[Math.floor(c.length / 2)] / width)
      .filter((x) => x > 0.02 && x < 0.98);
    const left = outerLines.filter((x) => x < middle - 0.2).at(-1) ?? 0.025,
      right = outerLines.find((x) => x > middle + 0.2) ?? 0.975;
    return [
      { x: left + 0.004, y: 0.025, w: middle - left - 0.008, h: 0.95 },
      { x: middle + 0.004, y: 0.025, w: right - middle - 0.008, h: 0.95 },
    ];
  }
  return [];
}
export function usableText(lines: TextLine[]) {
  const valid = lines.filter(
    (l) =>
      l.x >= 0 &&
      l.y >= 0 &&
      l.x + l.w <= 1.02 &&
      l.y + l.h <= 1.02 &&
      l.w > 0 &&
      l.h > 0,
  );
  const text = valid.map((l) => l.text).join("");
  return (
    valid.length >= 3 &&
    valid.length >= lines.length * 0.9 &&
    text.replace(/\s/g, "").length >= 25 &&
    (text.match(/[�\u0000-\u0008]/g)?.length ?? 0) < text.length * 0.03
  );
}
