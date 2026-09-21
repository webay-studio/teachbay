import type { Rect } from "./base-types";
/** PDF.js operator bounds, transformed through save/restore CTM and viewport.
 * Clip-only paths and page-sized backgrounds are not question content.
 */
export function pdfGeometry(
  ops: { fnArray: number[]; argsArray: unknown[][] },
  codes: Record<string, number>,
  viewport: number[],
  width: number,
  height: number,
  horizontalRules?: Rect[],
): Rect[] {
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [],
    rects: Rect[] = [];
  const mul = (a: number[], b: number[]) => [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const op = ops.fnArray[i],
      args = ops.argsArray[i];
    if (op === codes.save) stack.push([...ctm]);
    else if (op === codes.restore) ctm = stack.pop() ?? ctm;
    else if (op === codes.transform) ctm = mul(ctm, args as number[]);
    else if (
      op === codes.constructPath &&
      Number(args[0]) >= codes.stroke &&
      Number(args[0]) <= codes.closeEOFillStroke
    ) {
      const bbox = args[2] as ArrayLike<number> | undefined;
      if (!bbox) continue;
      const m = mul(viewport, ctm),
        [x0, y0, x1, y1] = Array.from(bbox);
      const corners = [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ].map(([x, y]) => [
        (m[0] * x + m[2] * y + m[4]) / width,
        (m[1] * x + m[3] * y + m[5]) / height,
      ]);
      const x = Math.min(...corners.map((p) => p[0])),
        y = Math.min(...corners.map((p) => p[1]));
      const r = {
        x,
        y,
        w: Math.max(...corners.map((p) => p[0])) - x,
        h: Math.max(...corners.map((p) => p[1])) - y,
      };
      if (
        r.w > 0.6 &&
        r.h < 0.003 &&
        r.x >= 0 &&
        r.y >= 0 &&
        r.x + r.w <= 1.005 &&
        r.y <= 1
      )
        horizontalRules?.push(r);
      if (
        r.x >= 0 &&
        r.y >= 0 &&
        r.x + r.w <= 1.005 &&
        r.y + r.h <= 1.005 &&
        r.w > 0.035 &&
        r.h > 0.012 &&
        r.w < 0.85 &&
        r.h < 0.8 &&
        !rects.some(
          (a) =>
            Math.abs(a.x - r.x) < 0.001 &&
            Math.abs(a.y - r.y) < 0.001 &&
            Math.abs(a.w - r.w) < 0.001 &&
            Math.abs(a.h - r.h) < 0.001,
        )
      )
        rects.push(r);
    }
  }
  return rects;
}

/** Preserve every raster placement, including tiny inline printed glyphs. */
export function pdfRasterContainers(
  ops: { fnArray: number[]; argsArray: unknown[][] },
  codes: Record<string, number>,
  viewport: number[],
  width: number,
  height: number,
): import("./question-regions").SourceContainer[] {
  let m = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [],
    tiles: Rect[] = [];
  const mul = (a: number[], b: number[]) => [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const op = ops.fnArray[i];
    if (op === codes.save) stack.push([...m]);
    else if (op === codes.restore) m = stack.pop() ?? m;
    else if (op === codes.transform) m = mul(m, ops.argsArray[i] as number[]);
    else if (
      [
        codes.paintImageXObject,
        codes.paintInlineImageXObject,
        codes.paintImageMaskXObject,
      ].includes(op)
    ) {
      const t = mul(viewport, m),
        ps = [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ].map(([x, y]) => [
          (t[0] * x + t[2] * y + t[4]) / width,
          (t[1] * x + t[3] * y + t[5]) / height,
        ]);
      const x = Math.min(...ps.map((p) => p[0])),
        y = Math.min(...ps.map((p) => p[1])),
        w = Math.max(...ps.map((p) => p[0])) - x,
        h = Math.max(...ps.map((p) => p[1])) - y;
      if (
        w > 0 &&
        h > 0 &&
        x >= -0.01 &&
        y >= -0.01 &&
        x + w <= 1.01 &&
        y + h <= 1.01
      )
        tiles.push({ x, y, w, h });
    }
  }
  const containers: import("./question-regions").SourceContainer[] = [];
  for (const r of tiles.sort((a, b) => a.y - b.y || a.x - b.x)) {
    // Require matching width/alignment and a seam, not merely nearby centers.
    const c = containers.find(
      (c) =>
        r.w > 0.08 &&
        Math.abs(c.rect.x - r.x) < 0.0015 &&
        Math.abs(c.rect.w - r.w) < 0.0015 &&
        Math.abs(c.rect.y + c.rect.h - r.y) < 0.0015,
    );
    if (c) {
      c.tiles.push(r);
      c.rect.h = r.y + r.h - c.rect.y;
    } else
      containers.push({
        id: crypto.randomUUID(),
        kind: "raster",
        rect: { ...r },
        tiles: [r],
      });
  }
  return containers;
}
