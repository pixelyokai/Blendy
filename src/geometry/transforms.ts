import type { Rect } from "./bounds";
import type { Shape } from "../model/shape";
import { clampRadius, MIN_SIZE } from "../model/shape";

/** Map a shape from one bounding box to another, scaling radius with geometry. */
export function mapShapeToBounds(shape: Shape, from: Rect, to: Rect): Shape {
  const sx = from.width === 0 ? 1 : to.width / from.width;
  const sy = from.height === 0 ? 1 : to.height / from.height;

  const width = Math.max(MIN_SIZE, shape.width * sx);
  const height = Math.max(MIN_SIZE, shape.height * sy);
  const x = to.x + (shape.x - from.x) * sx;
  const y = to.y + (shape.y - from.y) * sy;
  const radius = clampRadius(shape.radius * Math.min(Math.abs(sx), Math.abs(sy)), width, height);

  return { ...shape, x, y, width, height, radius };
}
