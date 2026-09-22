import {
  clampInnerRatio,
  clampPoints,
  clampSides,
  type Shape,
  type ShapeType,
} from "../model/shape";

export type Point = { x: number; y: number };

const n = (value: number) => Math.round(value * 100) / 100;

/**
 * Rounds polygon corners by trimming both edges and arcing between the trim
 * points. Trim distance r/tan(theta/2) keeps the arc tangent to both edges; a
 * short edge caps the trim and the radius is solved back from it.
 */
function roundedPolygonPath(points: Point[], radius: number): string {
  if (points.length < 3) return "";
  if (radius <= 0.01) {
    return `M ${points.map((p) => `${n(p.x)} ${n(p.y)}`).join(" L ")} Z`;
  }

  const segments: string[] = [];
  let start: Point | null = null;

  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const previous = points[(i - 1 + points.length) % points.length];
    const next = points[(i + 1) % points.length];

    const toPrev = { x: previous.x - current.x, y: previous.y - current.y };
    const toNext = { x: next.x - current.x, y: next.y - current.y };
    const lenPrev = Math.hypot(toPrev.x, toPrev.y);
    const lenNext = Math.hypot(toNext.x, toNext.y);
    if (lenPrev < 0.001 || lenNext < 0.001) continue;

    const unitPrev = { x: toPrev.x / lenPrev, y: toPrev.y / lenPrev };
    const unitNext = { x: toNext.x / lenNext, y: toNext.y / lenNext };

    const cosTheta = Math.max(-1, Math.min(1, unitPrev.x * unitNext.x + unitPrev.y * unitNext.y));
    const theta = Math.acos(cosTheta);
    if (theta < 0.02 || Math.PI - theta < 0.02) continue;

    const tanHalf = Math.tan(theta / 2);
    let trim = radius / tanHalf;
    trim = Math.min(trim, lenPrev / 2, lenNext / 2);
    const effectiveRadius = trim * tanHalf;

    const from = { x: current.x + unitPrev.x * trim, y: current.y + unitPrev.y * trim };
    const to = { x: current.x + unitNext.x * trim, y: current.y + unitNext.y * trim };

    // Reflex corners (a star's waist) sweep the other way.
    const cross = unitPrev.x * unitNext.y - unitPrev.y * unitNext.x;
    const sweep = cross > 0 ? 0 : 1;

    if (!start) {
      start = from;
      segments.push(`M ${n(from.x)} ${n(from.y)}`);
    } else {
      segments.push(`L ${n(from.x)} ${n(from.y)}`);
    }
    segments.push(
      `A ${n(effectiveRadius)} ${n(effectiveRadius)} 0 0 ${sweep} ${n(to.x)} ${n(to.y)}`,
    );
  }

  if (!start) return "";
  segments.push("Z");
  return segments.join(" ");
}

function ellipsePath(x: number, y: number, width: number, height: number) {
  const rx = width / 2;
  const ry = height / 2;
  const cx = x + rx;
  const cy = y + ry;
  return `M ${n(cx - rx)} ${n(cy)} A ${n(rx)} ${n(ry)} 0 1 0 ${n(cx + rx)} ${n(cy)} A ${n(rx)} ${n(
    ry,
  )} 0 1 0 ${n(cx - rx)} ${n(cy)} Z`;
}

/** Unit-box outlines, scaled to the shape's bounds by `verticesFor`. */
const UNIT_OUTLINES: Partial<Record<ShapeType, Point[]>> = {
  triangle: [
    { x: 0.5, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ],
  // Isometric cube silhouette: pointed top and bottom, flat vertical sides.
  cube: [
    { x: 0.5, y: 0 },
    { x: 1, y: 0.25 },
    { x: 1, y: 0.75 },
    { x: 0.5, y: 1 },
    { x: 0, y: 0.75 },
    { x: 0, y: 0.25 },
  ],
  // Apex over a base seen in perspective, so it keeps a flat front edge.
  pyramid: [
    { x: 0.5, y: 0 },
    { x: 1, y: 0.8 },
    { x: 0.68, y: 1 },
    { x: 0.32, y: 1 },
    { x: 0, y: 0.8 },
  ],
};

function regularPolygon(sides: number): Point[] {
  const count = clampSides(sides);
  return Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / count;
    return { x: 0.5 + 0.5 * Math.cos(angle), y: 0.5 + 0.5 * Math.sin(angle) };
  });
}

function starPolygon(points: number, innerRatio: number): Point[] {
  const count = clampPoints(points);
  const inner = clampInnerRatio(innerRatio);
  return Array.from({ length: count * 2 }, (_, i) => {
    const angle = -Math.PI / 2 + (i * Math.PI) / count;
    const r = i % 2 === 0 ? 0.5 : 0.5 * inner;
    return { x: 0.5 + r * Math.cos(angle), y: 0.5 + r * Math.sin(angle) };
  });
}

function verticesFor(shape: Shape): Point[] | null {
  const unit =
    shape.type === "polygon"
      ? regularPolygon(shape.sides ?? 6)
      : shape.type === "star"
        ? starPolygon(shape.points ?? 5, shape.innerRatio ?? 0.45)
        : UNIT_OUTLINES[shape.type];
  if (!unit) return null;
  return unit.map((p) => ({ x: shape.x + p.x * shape.width, y: shape.y + p.y * shape.height }));
}

/** Elliptical cap depth on a cylinder or cone, driven by the radius. */
function capDepth(shape: Shape) {
  return Math.max(2, Math.min(shape.radius * 0.7, shape.height * 0.34, shape.width * 0.5));
}

const cache = new WeakMap<Shape, string>();

/** Shapes are immutable, so an unchanged shape reuses its path. */
export function shapePath(shape: Shape): string {
  let d = cache.get(shape);
  if (d === undefined) cache.set(shape, (d = buildPath(shape)));
  return d;
}

function buildPath(shape: Shape): string {
  const { x, y, width, height } = shape;

  switch (shape.type) {
    case "roundedRect": {
      const r = Math.min(shape.radius, width / 2, height / 2);
      return roundedPolygonPath(
        [
          { x, y },
          { x: x + width, y },
          { x: x + width, y: y + height },
          { x, y: y + height },
        ],
        r,
      );
    }

    case "ellipse":
      return ellipsePath(x, y, width, height);

    case "torus": {
      const inner = clampInnerRatio(shape.innerRatio ?? 0.44);
      const outer = ellipsePath(x, y, width, height);
      const hole = ellipsePath(
        x + (width * (1 - inner)) / 2,
        y + (height * (1 - inner)) / 2,
        width * inner,
        height * inner,
      );
      // Two subpaths with even-odd fill punch the hole.
      return `${outer} ${hole}`;
    }

    case "cylinder": {
      const cap = capDepth(shape);
      const rx = width / 2;
      return [
        `M ${n(x)} ${n(y + cap)}`,
        `A ${n(rx)} ${n(cap)} 0 0 1 ${n(x + width)} ${n(y + cap)}`,
        `L ${n(x + width)} ${n(y + height - cap)}`,
        `A ${n(rx)} ${n(cap)} 0 0 1 ${n(x)} ${n(y + height - cap)}`,
        "Z",
      ].join(" ");
    }

    case "cone": {
      const cap = capDepth(shape);
      const rx = width / 2;
      return [
        `M ${n(x + rx)} ${n(y)}`,
        `L ${n(x + width)} ${n(y + height - cap)}`,
        `A ${n(rx)} ${n(cap)} 0 0 1 ${n(x)} ${n(y + height - cap)}`,
        "Z",
      ].join(" ");
    }

    default: {
      const vertices = verticesFor(shape);
      if (!vertices) return "";
      return roundedPolygonPath(vertices, shape.radius);
    }
  }
}

export function needsEvenOdd(type: ShapeType) {
  return type === "torus";
}

/** Points along an SVG elliptical arc (x-rotation 0), per the SVG spec's centre conversion. */
function arcPoints(from: Point, rx: number, ry: number, large: boolean, sweep: boolean, to: Point, tolerance: number): Point[] {
  if (!rx || !ry) return [to];
  const x1 = (from.x - to.x) / 2;
  const y1 = (from.y - to.y) / 2;
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  let coef = den ? Math.sqrt(Math.max(0, (rx * rx * ry * ry - den) / den)) : 0;
  if (large === sweep) coef = -coef;
  const cxp = (coef * rx * y1) / ry;
  const cyp = (-coef * ry * x1) / rx;
  const cx = cxp + (from.x + to.x) / 2;
  const cy = cyp + (from.y + to.y) / 2;
  const ux = (x1 - cxp) / rx, uy = (y1 - cyp) / ry;
  const vx = (-x1 - cxp) / rx, vy = (-y1 - cyp) / ry;
  const start = Math.atan2(uy, ux);
  let delta = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  if (!sweep && delta > 0) delta -= Math.PI * 2;
  else if (sweep && delta < 0) delta += Math.PI * 2;
  const r = Math.max(rx, ry);
  const step = tolerance >= r ? Math.PI / 2 : 2 * Math.acos(1 - tolerance / r);
  const count = Math.max(1, Math.ceil(Math.abs(delta) / step));
  const points: Point[] = [];
  for (let i = 1; i < count; i += 1) {
    const a = start + (delta * i) / count;
    points.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
  }
  points.push(to);
  return points;
}

/**
 * The shape's outline as closed polylines in its own (unrotated) frame, arcs
 * flattened to within `tolerance`. Read back from the same path that is drawn,
 * so the goo measures distance to exactly what is on screen.
 */
export function shapeRings(shape: Shape, tolerance: number): Point[][] {
  const tokens = shapePath(shape).match(/[MLAZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  const rings: Point[][] = [];
  let ring: Point[] = [];
  let current: Point = { x: 0, y: 0 };
  let command = "";
  const num = (i: number) => Number(tokens[i]);
  for (let i = 0; i < tokens.length; ) {
    if (/^[MLAZ]$/i.test(tokens[i])) command = tokens[i++].toUpperCase();
    if (command === "Z") {
      if (ring.length > 2) rings.push(ring);
      ring = [];
      continue;
    }
    if (command === "M") {
      if (ring.length > 2) rings.push(ring);
      current = { x: num(i), y: num(i + 1) };
      ring = [current];
      i += 2;
      command = "L";
    } else if (command === "L") {
      current = { x: num(i), y: num(i + 1) };
      ring.push(current);
      i += 2;
    } else if (command === "A") {
      const to = { x: num(i + 5), y: num(i + 6) };
      ring.push(...arcPoints(current, num(i), num(i + 1), num(i + 3) === 1, num(i + 4) === 1, to, tolerance));
      current = to;
      i += 7;
    } else i += 1;
  }
  if (ring.length > 2) rings.push(ring);
  return rings;
}
