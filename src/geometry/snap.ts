import type { Rect } from "./bounds";

export type Guide = { axis: "x" | "y"; at: number; from: number; to: number };

const xs = (r: Rect) => [r.x, r.x + r.width / 2, r.x + r.width];
const ys = (r: Rect) => [r.y, r.y + r.height / 2, r.y + r.height];

function nearest(moving: number[], targets: number[][], threshold: number) {
  let best: number | null = null;
  for (const t of targets.flat())
    for (const m of moving) {
      const d = t - m;
      if (Math.abs(d) <= threshold && (best === null || Math.abs(d) < Math.abs(best))) best = d;
    }
  return best ?? 0;
}

/**
 * Snaps a moving box to the edges and centres of `targets`, Figma style, and
 * returns a guide for every line the snapped box now shares with a target.
 */
export function snap(moving: Rect, targets: Rect[], threshold: number) {
  const dx = nearest(xs(moving), targets.map(xs), threshold);
  const dy = nearest(ys(moving), targets.map(ys), threshold);
  const box = { ...moving, x: moving.x + dx, y: moving.y + dy };

  const guides: Guide[] = [];
  for (const t of targets) {
    for (const at of xs(t))
      if (xs(box).some((m) => Math.abs(m - at) < 0.5))
        guides.push({ axis: "x", at, from: Math.min(box.y, t.y), to: Math.max(box.y + box.height, t.y + t.height) });
    for (const at of ys(t))
      if (ys(box).some((m) => Math.abs(m - at) < 0.5))
        guides.push({ axis: "y", at, from: Math.min(box.x, t.x), to: Math.max(box.x + box.width, t.x + t.width) });
  }
  return { dx, dy, guides };
}
