import { clamp } from "../utils/clamp";
import type { Shape } from "../model/shape";
import { rotatedBounds } from "./rotate";

export type Rect = { x: number; y: number; width: number; height: number };

export const intersects = (a: Rect, b: Rect) =>
  a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;

export function unionRects(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const r of rects) {
    left = Math.min(left, r.x);
    top = Math.min(top, r.y);
    right = Math.max(right, r.x + r.width);
    bottom = Math.max(bottom, r.y + r.height);
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** A move of `box` by (dx, dy), limited so it stays on a size x size artboard. */
export const keepInside = (box: Rect, dx: number, dy: number, size: number) => ({
  dx: clamp(dx, -box.x, size - box.x - box.width),
  dy: clamp(dy, -box.y, size - box.y - box.height),
});

export function shapesBounds(shapes: Shape[]): Rect | null {
  return unionRects(shapes.filter((s) => !s.hidden).map(rotatedBounds));
}
