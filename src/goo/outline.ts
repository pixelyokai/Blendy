type Field = { data: Float32Array; width: number; height: number };
export type Pt = { x: number; y: number };
/** A signed field at any point, positive inside. */
export type Exact = (x: number, y: number) => number;

/**
 * Marching squares with linear interpolation, chained into closed loops.
 * Samples outside the field are treated as empty, so every loop closes.
 */
export function contours(field: Field, iso: number): Pt[][] {
  const { data, width: w, height: h } = field;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : data[y * w + x]);
  const crossing = (ax: number, ay: number, bx: number, by: number) => {
    const fa = at(ax, ay);
    return (iso - fa) / (at(bx, by) - fa);
  };

  // Crossing points keyed by the grid edge they sit on.
  const points = new Map<number, Pt>();
  const next = new Map<number, number>();
  const hKey = (x: number, y: number) => ((y + 1) * (w + 2) + (x + 1)) * 2;
  const vKey = (x: number, y: number) => hKey(x, y) + 1;

  const cross = (key: number, ax: number, ay: number, bx: number, by: number) => {
    if (!points.has(key)) {
      const t = crossing(ax, ay, bx, by);
      points.set(key, { x: ax + (bx - ax) * t, y: ay + (by - ay) * t });
    }
    return key;
  };

  for (let y = -1; y < h; y += 1) {
    for (let x = -1; x < w; x += 1) {
      const tl = at(x, y);
      const tr = at(x + 1, y);
      const br = at(x + 1, y + 1);
      const bl = at(x, y + 1);
      const code = (tl > iso ? 8 : 0) | (tr > iso ? 4 : 0) | (br > iso ? 2 : 0) | (bl > iso ? 1 : 0);
      if (code === 0 || code === 15) continue;

      const top = () => cross(hKey(x, y), x, y, x + 1, y);
      const right = () => cross(vKey(x + 1, y), x + 1, y, x + 1, y + 1);
      const bottom = () => cross(hKey(x, y + 1), x, y + 1, x + 1, y + 1);
      const left = () => cross(vKey(x, y), x, y, x, y + 1);

      // Segments run with the filled side on the right, so loops chain in one direction.
      const link = (from: number, to: number) => next.set(from, to);
      const centre = (tl + tr + br + bl) / 4 > iso;
      switch (code) {
        case 1: link(left(), bottom()); break;
        case 2: link(bottom(), right()); break;
        case 3: link(left(), right()); break;
        case 4: link(right(), top()); break;
        case 5: if (centre) { link(left(), top()); link(right(), bottom()); } else { link(left(), bottom()); link(right(), top()); } break;
        case 6: link(bottom(), top()); break;
        case 7: link(left(), top()); break;
        case 8: link(top(), left()); break;
        case 9: link(top(), bottom()); break;
        case 10: if (centre) { link(top(), right()); link(bottom(), left()); } else { link(top(), left()); link(bottom(), right()); } break;
        case 11: link(top(), right()); break;
        case 12: link(right(), left()); break;
        case 13: link(right(), bottom()); break;
        case 14: link(bottom(), left()); break;
      }
    }
  }

  const loops: Pt[][] = [];
  const seen = new Set<number>();
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const loop: Pt[] = [];
    let key: number | undefined = start;
    while (key !== undefined && !seen.has(key)) {
      seen.add(key);
      loop.push(points.get(key)!);
      key = next.get(key);
    }
    if (loop.length > 2) loops.push(loop);
  }
  return loops;
}

function simplifyOpen(points: Pt[], tolerance: number): Pt[] {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const pa = points[a];
    const pb = points[b];
    const dx = pb.x - pa.x;
    const dy = pb.y - pa.y;
    const len = Math.hypot(dx, dy) || 1;
    let max = 0;
    let index = -1;
    for (let i = a + 1; i < b; i += 1) {
      const d = Math.abs((points[i].x - pa.x) * dy - (points[i].y - pa.y) * dx) / len;
      if (d > max) {
        max = d;
        index = i;
      }
    }
    if (max > tolerance && index > 0) {
      keep[index] = 1;
      stack.push([a, index], [index, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Ramer-Douglas-Peucker on a closed loop, split at its two farthest points. */
export function simplify(loop: Pt[], tolerance: number): Pt[] {
  let far = 0;
  let best = 0;
  for (let i = 1; i < loop.length; i += 1) {
    const d = (loop[i].x - loop[0].x) ** 2 + (loop[i].y - loop[0].y) ** 2;
    if (d > best) {
      best = d;
      far = i;
    }
  }
  const first = simplifyOpen(loop.slice(0, far + 1), tolerance);
  const second = simplifyOpen([...loop.slice(far), loop[0]], tolerance);
  return [...first.slice(0, -1), ...second.slice(0, -1)];
}

/** Turns sharper than this stay corners; gentler ones are smoothed into curves. */
const CORNER = (55 * Math.PI) / 180;

const r2 = (v: number) => Math.round(v * 100) / 100;

function turn(a: Pt, b: Pt, c: Pt) {
  const ux = b.x - a.x, uy = b.y - a.y, vx = c.x - b.x, vy = c.y - b.y;
  return Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
}

/**
 * Marching squares cuts a sharp corner into a short chamfer with two half turns.
 * Where that happens, restore the corner at the intersection of the adjacent edges,
 * if `accept` agrees it is really there (a small rounded tip also looks like a chamfer).
 */
export function sharpen(loop: Pt[], maxChamfer: number, accept: (p: Pt) => boolean = () => true): Pt[] {
  const pts = [...loop];
  for (let i = 0; pts.length > 4 && i < pts.length; i += 1) {
    const n = pts.length;
    const [p0, p1, p2, p3] = [0, 1, 2, 3].map((k) => pts[(i + k - 1 + n) % n]);
    if (Math.hypot(p2.x - p1.x, p2.y - p1.y) > maxChamfer) continue;
    const t1 = turn(p0, p1, p2);
    const t2 = turn(p1, p2, p3);
    if (Math.sign(t1) !== Math.sign(t2) || Math.abs(t1 + t2) < CORNER) continue;
    const d1x = p1.x - p0.x, d1y = p1.y - p0.y, d2x = p3.x - p2.x, d2y = p3.y - p2.y;
    const den = d1x * d2y - d1y * d2x;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((p2.x - p0.x) * d2y - (p2.y - p0.y) * d2x) / den;
    const corner = { x: p0.x + d1x * t, y: p0.y + d1y * t };
    if (!accept(corner)) continue;
    pts[i % n] = corner;
    pts.splice((i + 1) % n, 1);
  }
  return pts;
}

/** Newton steps onto the zero level of f; null if that would move p more than a few steps of h. */
function project(p: Pt, f: Exact, h: number): Pt | null {
  let { x, y } = p;
  for (let i = 0; i < 4; i += 1) {
    const v = f(x, y);
    if (Math.abs(v) < h * 0.02) break;
    const gx = (f(x + h, y) - f(x - h, y)) / (2 * h);
    const gy = (f(x, y + h) - f(x, y - h)) / (2 * h);
    const g2 = gx * gx + gy * gy;
    if (g2 < 1e-6) break;
    x -= (v * gx) / g2;
    y -= (v * gy) / g2;
  }
  return Math.hypot(x - p.x, y - p.y) < h * 6 ? { x, y } : null;
}

/**
 * Puts a traced loop on the exact outline: every vertex is projected onto it, and
 * any edge whose midpoint strays more than a tenth of a cell is split, so tips and
 * curves come out true whatever the sampling missed.
 */
export function refine(loop: Pt[], f: Exact, cell: number): Pt[] {
  const h = cell * 0.25;
  const pts = loop.map((p) => project(p, f, h) ?? p);
  const out: Pt[] = [];
  const split = (a: Pt, b: Pt, depth: number) => {
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (depth > 3 || Math.abs(f(m.x, m.y)) < cell * 0.1) return;
    const q = project(m, f, h);
    if (!q) return;
    split(a, q, depth + 1);
    out.push(q);
    split(q, b, depth + 1);
  };
  pts.forEach((p, i) => {
    out.push(p);
    split(p, pts[(i + 1) % pts.length], 0);
  });
  return out;
}

/**
 * Closed loops to a path of quadratic curves with each vertex as the control
 * point. Where a long edge meets a short one, the curve reaches along the long one
 * only as far as the short one is long (or `reach`), so long straight edges stay
 * straight right up to a gentle corner; sharp turns stay true corners.
 */
export function loopsToPath(loops: Pt[][], reach = Infinity): string {
  const f = (p: Pt) => `${r2(p.x)} ${r2(p.y)}`;
  return loops
    .map((pts) => {
      const n = pts.length;
      const len = (i: number) => Math.hypot(pts[(i + 1) % n].x - pts[i % n].x, pts[(i + 1) % n].y - pts[i % n].y);
      // The point on edge i -> j where the curve around vertex i meets it.
      const at = (i: number, j: number) => {
        const a = pts[i % n], b = pts[j % n];
        // Midway, unless this edge dwarfs the vertex's other one: then only as far as
        // that one is long, so a long straight edge keeps its line up to the corner.
        const edge = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const other = j > i ? len(i + n - 1) : len(i);
        const t = edge > other * 3 && edge > reach * 2 ? Math.max(reach, other) / edge : 0.5;
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      };
      let d = `M${f(at(0, 1))}`;
      for (let i = 1; i <= n; i += 1) {
        const prev = pts[(i - 1) % n], p = pts[i % n];
        const entry = at(i, i - 1);
        const exit = at(i - 1, i);
        if (Math.hypot(entry.x - exit.x, entry.y - exit.y) > 0.01) d += `L${f(entry)}`;
        const sharp = Math.abs(turn(prev, p, pts[(i + 1) % n])) > CORNER;
        d += sharp ? `L${f(p)}L${f(at(i, i + 1))}` : `Q${f(p)} ${f(at(i, i + 1))}`;
      }
      return `${d}Z`;
    })
    .join("");
}

/** Grid loops to canvas units: sample (i, j) sits at the centre of its cell. */
export function toCanvas(loops: Pt[][], originX: number, originY: number, cell: number): Pt[][] {
  return loops.map((loop) =>
    loop.map((p) => ({ x: originX + (p.x + 0.5) * cell, y: originY + (p.y + 0.5) * cell })),
  );
}
