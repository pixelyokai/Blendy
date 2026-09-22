import type { Shape } from "../model/shape";
import type { Rect } from "./bounds";

type Vec = { x: number; y: number };

const toRadians = (deg: number) => (deg * Math.PI) / 180;
export const toDegrees = (rad: number) => (rad * 180) / Math.PI;

export function shapeCenter(shape: Shape): Vec {
  return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
}

export function rectCenter(rect: Rect): Vec {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/** Rotate a free vector (no origin) clockwise by `deg`. */
export function rotateVec(v: Vec, deg: number): Vec {
  if (!deg) return v;
  const a = toRadians(deg);
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
}

export function rotateAbout(point: Vec, origin: Vec, deg: number): Vec {
  if (!deg) return point;
  const d = rotateVec({ x: point.x - origin.x, y: point.y - origin.y }, deg);
  return { x: origin.x + d.x, y: origin.y + d.y };
}

/** AABB containing the rotated shape; the stored rect describes it un-turned. */
export function rotatedBounds(shape: Shape): Rect {
  if (!shape.rotation) {
    return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
  }
  const centre = shapeCenter(shape);
  const corners: Vec[] = [
    { x: shape.x, y: shape.y },
    { x: shape.x + shape.width, y: shape.y },
    { x: shape.x + shape.width, y: shape.y + shape.height },
    { x: shape.x, y: shape.y + shape.height },
  ].map((corner) => rotateAbout(corner, centre, shape.rotation));

  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return { x: left, y: top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
}

/** Turns a shape about its own centre; null when upright. */
export function rotationTransform(shape: Shape): string | null {
  if (!shape.rotation) return null;
  const centre = shapeCenter(shape);
  const r = (v: number) => Math.round(v * 100) / 100;
  return `rotate(${r(shape.rotation)} ${r(centre.x)} ${r(centre.y)})`;
}

/** Reposition a shape so its centre lands on `centre`, keeping its size. */
export function withCenter(shape: Shape, centre: Vec): Shape {
  return { ...shape, x: centre.x - shape.width / 2, y: centre.y - shape.height / 2 };
}
