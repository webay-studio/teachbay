import type { Rect } from "./types";

export type ResizeHandle = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";
export const REGION_HANDLES: ResizeHandle[] = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
];
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function moveRegion(rect: Rect, dx: number, dy: number): Rect {
  return {
    ...rect,
    x: clamp(rect.x + dx, 0, 1 - rect.w),
    y: clamp(rect.y + dy, 0, 1 - rect.h),
  };
}

export function resizeRegion(
  rect: Rect,
  handle: ResizeHandle,
  dx: number,
  dy: number,
): Rect {
  let left = rect.x,
    top = rect.y,
    right = rect.x + rect.w,
    bottom = rect.y + rect.h;
  const minWidth = Math.min(0.01, rect.w),
    minHeight = Math.min(0.005, rect.h);
  if (handle.includes("w")) left = clamp(left + dx, 0, right - minWidth);
  if (handle.includes("e")) right = clamp(right + dx, left + minWidth, 1);
  if (handle.includes("n")) top = clamp(top + dy, 0, bottom - minHeight);
  if (handle.includes("s")) bottom = clamp(bottom + dy, top + minHeight, 1);
  return { x: left, y: top, w: right - left, h: bottom - top };
}

export function drawRegion(
  start: { x: number; y: number },
  end: { x: number; y: number },
): Rect {
  const x1 = clamp(start.x, 0, 1),
    y1 = clamp(start.y, 0, 1),
    x2 = clamp(end.x, 0, 1),
    y2 = clamp(end.y, 0, 1);
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1),
  };
}
