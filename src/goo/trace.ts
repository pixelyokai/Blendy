import { contours, loopsToPath, refine, sharpen, simplify, toCanvas, type Exact, type Pt } from "./outline";
import { shapeRings } from "../geometry/shapePath";
import { rotatedBounds, rotateVec, shapeCenter } from "../geometry/rotate";
import { unionRects, type Rect } from "../geometry/bounds";
import type { Shape } from "../model/shape";

const INF = 1e20;
const MAX_SAMPLES = 1_600_000;
const BLOCK = 6;

type Bend = { ids: Set<string>; angle: number; sx: number; sy: number };

export type OutlineInput = {
  shapes: Shape[];
  bend?: Bend | null;
  /** Fillet radius in canvas units. */
  smooth: number;
  /** Canvas units per sample; smaller is sharper and slower. */
  cell: number;
  /** Only trace inside this region (the visible view), so cost follows screen size, not zoom. */
  clip?: Rect;
  /** Fill for shapes without their own; with more than one colour the goo is split into a piece per colour. */
  defaultFill?: string;
  /** Snap the result onto the exact outlines; off for quick passes while dragging. */
  precise?: boolean;
};

/** `parts` are in paint order, each overlapping the next by a hair so seams never show. */
export type Outline = { d: string; bounds: Rect | null; parts: { fill: string; d: string }[] };

/**
 * Fillet profile: a superellipse of this power in place of a circle. Above 2 its
 * curvature eases to nothing where it meets each shape, so joins flow in rather
 * than breaking off at a visible seam.
 */
const POWER = 3;
/** Keeps the join as deep as a circular fillet of the goo radius would be. */
export const FILLET_SCALE = (1 - Math.SQRT1_2) / (1 - 2 ** (-1 / POWER));

/** Smooth union with a cubic superellipse fillet of radius k. */
function smin(a: number, b: number, k: number) {
  const ua = k - a;
  const ub = k - b;
  return ua > 0 && ub > 0 ? k - Math.cbrt(ua * ua * ua + ub * ub * ub) : Math.min(a, b);
}

/**
 * The goo at a point from its three nearest shapes (d1 <= d2 <= d3). Blending only
 * by distance keeps it continuous everywhere and independent of the order shapes
 * arrive in: swapping two equal distances changes nothing.
 */
const gooAt = (d1: number, d2: number, d3: number, k: number) => (k > 0 ? smin(smin(d1, d2, k), d3, k) : d1);

const STRIDE = 6;

/** Signed distance to a shape's segments ([ax, ay, dx, dy, 1/len², by] each), negative inside. */
function sdfTo(seg: Float64Array, px: number, py: number) {
  let best = INF;
  let inside = false;
  for (let s = 0; s < seg.length; s += STRIDE) {
    const ax = seg[s], ay = seg[s + 1], dx = seg[s + 2], dy = seg[s + 3];
    const t = Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) * seg[s + 4]));
    const qx = ax + t * dx - px;
    const qy = ay + t * dy - py;
    const d2 = qx * qx + qy * qy;
    if (d2 < best) best = d2;
    // Even-odd ray cast, which also punches the torus hole. The end y is stored,
    // not ay + dy: rounding there would count a shared vertex twice.
    if (ay > py !== seg[s + 5] > py && px < ax + ((py - ay) * dx) / dy) inside = !inside;
  }
  return inside ? -Math.sqrt(best) : Math.sqrt(best);
}

/** Rings as flat segments. Closed paths repeat their first point; that zero-length edge is dropped. */
function segments(rings: Pt[][]) {
  const seg: number[] = [];
  for (const ring of rings)
    ring.forEach((a, i) => {
      const b = ring[(i + 1) % ring.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (Math.abs(dx) + Math.abs(dy) > 1e-9) seg.push(a.x, a.y, dx, dy, 1 / (dx * dx + dy * dy), b.y);
    });
  return Float64Array.from(seg);
}

/** The outline in canvas space: rotated, and stretched when the shape is bending. */
function worldRings(shape: Shape, bend: Bend | null | undefined, tolerance: number) {
  const c = shapeCenter(shape);
  const bent = bend?.ids.has(shape.id) ? bend : null;
  return shapeRings(shape, tolerance).map((ring) =>
    ring.map((p) => {
      let v = rotateVec({ x: p.x - c.x, y: p.y - c.y }, shape.rotation);
      if (bent) {
        v = rotateVec(v, -bent.angle);
        v = rotateVec({ x: v.x * bent.sx, y: v.y * bent.sy }, bent.angle);
      }
      return { x: c.x + v.x, y: c.y + v.y };
    }),
  );
}

/**
 * Traces the goo as vector geometry: a rolling-ball union of every shape's exact
 * signed distance field, measured to its real outline. Where two shapes are close a
 * round fillet joins them; everywhere else the shape is exact, and a shape never blends with its
 * own notches.
 */
export function gooOutline({ shapes, bend, smooth, cell, clip, defaultFill = "", precise = true }: OutlineInput): Outline {
  const k = smooth * FILLET_SCALE;
  const visible = shapes.filter((s) => !s.hidden);
  const content = unionRects(visible.map(rotatedBounds));
  if (!content) return { d: "", bounds: null, parts: [] };
  // Colours ordered by their topmost shape, so higher shapes paint over lower ones.
  const fills = visible.map((s) => s.fill ?? defaultFill);
  const colors = [...new Set(fills)].sort((a, b) => fills.lastIndexOf(a) - fills.lastIndexOf(b));

  // Room for the fillet plus the bend's stretch.
  const reach = k + Math.max(content.width, content.height) * 0.08 + cell * 2;
  let x0 = content.x - reach;
  let y0 = content.y - reach;
  let x1 = content.x + content.width + reach;
  let y1 = content.y + content.height + reach;
  if (clip) {
    x0 = Math.max(x0, clip.x);
    y0 = Math.max(y0, clip.y);
    x1 = Math.min(x1, clip.x + clip.width);
    y1 = Math.min(y1, clip.y + clip.height);
    if (x1 <= x0 || y1 <= y0) return { d: "", bounds: null, parts: [] };
  }
  cell = Math.max(cell, Math.sqrt(((x1 - x0) * (y1 - y0)) / MAX_SAMPLES));
  // Samples sit on a fixed lattice, so shapes that are not moving are sampled the
  // same way every frame while another is dragged, and their edges hold still.
  x0 = Math.floor(x0 / cell) * cell;
  y0 = Math.floor(y0 / cell) * cell;
  const W = Math.ceil((x1 - x0) / cell);
  const H = Math.ceil((y1 - y0) / cell);

  // Union distance per sample. Each shape only touches the window it can influence.
  // The three nearest shapes per sample.
  const n = W * H;
  const [d1, d2, d3] = [0, 1, 2].map(() => new Float32Array(n).fill(INF));
  // Plain nearest distance per colour, to split the goo between colours.
  const nearest = colors.length > 1 ? colors.map(() => new Float32Array(W * H).fill(INF)) : null;
  // Every shape's segments and extent, kept to evaluate the exact field anywhere.
  const sources: { seg: Float64Array; box: Rect; color: number }[] = [];
  for (const [index, shape] of visible.entries()) {
    const color = colors.indexOf(fills[index]);
    const mine = nearest?.[color];
    // The grid only needs arcs flattened to a quarter cell; the exact field is only
    // sampled at the outline, so it can afford them nearly true.
    const seg = segments(worldRings(shape, bend, cell * 0.25));
    if (precise) {
      const fine = worldRings(shape, bend, cell * 0.02);
      const all = fine.flat();
      const xs = all.map((q) => q.x), ys = all.map((q) => q.y);
      const bx0 = Math.min(...xs), by0 = Math.min(...ys);
      sources.push({ seg: segments(fine), box: { x: bx0, y: by0, width: Math.max(...xs) - bx0, height: Math.max(...ys) - by0 }, color });
    }
    const box = rotatedBounds(shape);
    const grow = k + Math.max(box.width, box.height) * 0.08 + cell * 2;
    const gx0 = Math.max(0, Math.floor((box.x - grow - x0) / cell));
    const gy0 = Math.max(0, Math.floor((box.y - grow - y0) / cell));
    const gx1 = Math.min(W, Math.ceil((box.x + box.width + grow - x0) / cell));
    const gy1 = Math.min(H, Math.ceil((box.y + box.height + grow - y0) / cell));

    const sdf = (px: number, py: number) => sdfTo(seg, px, py);
    const put = (gx: number, gy: number, d: number) => {
      const g = gy * W + gx;
      if (d < d1[g]) (d3[g] = d2[g]), (d2[g] = d1[g]), (d1[g] = d);
      else if (d < d2[g]) (d3[g] = d2[g]), (d2[g] = d);
      else if (d < d3[g]) d3[g] = d;
      if (mine && d < mine[g]) mine[g] = d;
    };

    // Distance changes no faster than position, so a block whose centre is far
    // from the edge only needs a bound; exact values matter near the fillet band.
    const reachB = BLOCK * cell * Math.SQRT1_2;
    const band = k + cell * 2 + reachB;
    for (let by = gy0; by < gy1; by += BLOCK)
      for (let bx = gx0; bx < gx1; bx += BLOCK) {
        const ex = Math.min(bx + BLOCK, gx1), ey = Math.min(by + BLOCK, gy1);
        const c = sdf(x0 + ((bx + ex) / 2) * cell, y0 + ((by + ey) / 2) * cell);
        if (Math.abs(c) > band) {
          const bound = c > 0 ? c - reachB : c + reachB;
          for (let gy = by; gy < ey; gy += 1) for (let gx = bx; gx < ex; gx += 1) put(gx, gy, bound);
          continue;
        }
        for (let gy = by; gy < ey; gy += 1)
          for (let gx = bx; gx < ex; gx += 1) put(gx, gy, sdf(x0 + (gx + 0.5) * cell, y0 + (gy + 0.5) * cell));
      }
  }

  // Positive inside, as the tracer expects.
  const field = new Float32Array(n);
  for (let i = 0; i < n; i += 1) field[i] = -gooAt(d1[i], d2[i], d3[i], k);

  // The exact field anywhere, for one colour's piece when `c` is given. Shapes
  // further than the fillet can't change it near the outline, so they are skipped.
  const exactAt = (px: number, py: number, c = -1) => {
    let [e1, e2, e3] = [INF, INF, INF];
    const near = c >= 0 ? colors.map(() => INF) : null;
    for (const { seg, box, color } of sources) {
      const gx = Math.max(box.x - px, 0, px - box.x - box.width);
      const gy = Math.max(box.y - py, 0, py - box.y - box.height);
      if (gx * gx + gy * gy > (k + cell * 4) ** 2) continue;
      const d = sdfTo(seg, px, py);
      if (d < e1) [e3, e2, e1] = [e2, e1, d];
      else if (d < e2) [e3, e2] = [e2, d];
      else if (d < e3) e3 = d;
      if (near && d < near[color]) near[color] = d;
    }
    const u = gooAt(e1, e2, e3, k);
    if (!near) return -u;
    let other = INF;
    near.forEach((d, o) => o !== c && d < other && (other = d));
    return Math.min(-u, Math.max((other - near[c]) / 2 + cell, -near[c]));
  };
  const trace = (data: Float32Array, f: Exact) => {
    const loops = toCanvas(contours({ data, width: W, height: H }, 0).map((loop) => simplify(loop, 0.22)), x0, y0, cell);
    return precise
      ? loops.map((loop) => refine(sharpen(loop, cell * 1.6, (q) => Math.abs(f(q.x, q.y)) < cell * 0.02), f, cell))
      : loops; // Exact vectors cover a quick pass, so it must only ever err inward: no restored corners.
  };
  const loops = trace(field, exactAt);
  const d = loopsToPath(loops, cell * 2);
  if (!nearest) return { d, bounds: loopBounds(loops), parts: [{ fill: colors[0], d }] };

  // Each colour owns its shapes plus the part of the goo nearer to it than to any
  // other colour, so a join between colours splits down the middle.
  const piece = new Float32Array(field.length);
  const parts = colors.map((fill, c) => {
    const own = nearest[c];
    for (let i = 0; i < field.length; i += 1) {
      let other = INF;
      for (let o = 0; o < nearest.length; o += 1) if (o !== c && nearest[o][i] < other) other = nearest[o][i];
      piece[i] = Math.min(field[i], Math.max((other - own[i]) / 2 + cell, -own[i]));
    }
    return { fill, d: loopsToPath(trace(piece, (px, py) => exactAt(px, py, c)), cell * 2) };
  });
  return { d, bounds: loopBounds(loops), parts };
}

function loopBounds(loops: Pt[][]): Rect | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const loop of loops) for (const p of loop) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  return minX === Infinity ? null : { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
