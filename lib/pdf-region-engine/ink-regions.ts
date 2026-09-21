import type { Rect } from "./base-types";
/** Connected ink components from the preprocessed image; no model or remote call. */
export async function findInkRegions(
  source: HTMLCanvasElement,
  signal: AbortSignal,
  connectLetters = true,
  connectivity: 4 | 8 = 4,
): Promise<Rect[]> {
  const scale = Math.min(1, 1200 / source.width),
    canvas = document.createElement("canvas");
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const w = canvas.width,
    h = canvas.height,
    data = ctx.getImageData(0, 0, w, h).data,
    mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (Math.min(data[i], data[i + 1], data[i + 2]) < 175 && data[i + 3] > 0)
        mask[y * w + x] = 1;
    }
  // Close small gaps between strokes/letters without filling entire whitespace bands.
  const joined = connectLetters ? new Uint8Array(mask.length) : mask;
  if (connectLetters)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (mask[y * w + x])
          for (
            let dy = connectLetters ? -1 : 0;
            dy <= (connectLetters ? 1 : 0);
            dy++
          )
            for (
              let dx = connectLetters ? -2 : 0;
              dx <= (connectLetters ? 2 : 0);
              dx++
            ) {
              const xx = x + dx,
                yy = y + dy;
              if (xx >= 0 && xx < w && yy >= 0 && yy < h)
                joined[yy * w + xx] = 1;
            }
  const neighbors = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    ...(connectivity === 8
      ? [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ]
      : []),
  ];
  const queue = new Int32Array(w * h),
    regions: Rect[] = [];
  for (let y = 0; y < h; y++) {
    if (y % 64 === 0) {
      if (signal.aborted)
        throw new DOMException("취소되었습니다.", "AbortError");
      await new Promise<void>((r) => setTimeout(r, 0));
    }
    for (let x = 0; x < w; x++) {
      const start = y * w + x;
      if (!joined[start]) continue;
      let head = 0,
        tail = 1,
        minX = x,
        maxX = x,
        minY = y,
        maxY = y;
      queue[0] = start;
      joined[start] = 0;
      while (head < tail) {
        const at = queue[head++],
          xx = at % w,
          yy = Math.floor(at / w);
        minX = Math.min(minX, xx);
        maxX = Math.max(maxX, xx);
        minY = Math.min(minY, yy);
        maxY = Math.max(maxY, yy);
        for (const [dx, dy] of neighbors) {
          const nx = xx + dx,
            ny = yy + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const n = ny * w + nx;
          if (joined[n]) {
            joined[n] = 0;
            queue[tail++] = n;
          }
        }
      }
      // Keep small punctuation and decimal points; ownership is decided later.
      const rw = maxX - minX + 1,
        rh = maxY - minY + 1;
      // Long thin page/column rules only. Retain shorter fraction bars and graph axes.
      if (
        (rh > h * 0.55 && rw < Math.max(8, w * 0.01)) ||
        (rw > w * 0.8 && rh < 8)
      )
        continue;
      // A connected rectangular page frame is neither a thin vertical nor horizontal
      // component. Identify its perimeter concentration before converting it to a dot.
      const spansPage =
        rw > w * 0.65 && rh > h * 0.6 && minX < w * 0.2 && maxX > w * 0.8;
      if (spansPage) {
        const band = Math.max(4, Math.round(Math.min(w, h) * 0.008));
        let edge = 0;
        for (let q = 0; q < tail; q++) {
          const px = queue[q] % w,
            py = Math.floor(queue[q] / w);
          if (
            px - minX < band ||
            maxX - px < band ||
            py - minY < band ||
            maxY - py < band
          )
            edge++;
        }
        if (edge / tail > 0.65) continue;
      }
      regions.push({
        pixelCount: tail,
        x: Math.max(0, minX - 2) / w,
        y: Math.max(0, minY - 1) / h,
        w: Math.min(w - minX, rw + 2) / w,
        h: Math.min(h - minY, rh + 1) / h,
      });
    }
  }
  canvas.width = canvas.height = 1;
  return regions;
}
