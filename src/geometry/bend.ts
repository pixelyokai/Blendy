import { clamp } from "../utils/clamp";

/** Lag beyond this is clamped, so a fast flick cannot tear the block loose. */
const MAX_LAG = 44;

/** Lag at which the stretch reaches full strength. */
const LAG_REFERENCE = 55;

/** Peak elongation along the direction of travel. */
const MAX_STRETCH = 0.14;

const MIN_LAG = 0.15;

/**
 * Squash and stretch for a dragged block. The render trails the real position
 * by the lag vector, which gives both direction and amount: the block stretches
 * along its travel and thins across it, conserving area. No rotation or shear -
 * a tilted block reads as a different shape, not a soft one.
 */
export function bendParams(lagX: number, lagY: number) {
  const magnitude = Math.hypot(lagX, lagY);
  if (magnitude < MIN_LAG) return null;
  const sx = 1 + clamp(magnitude / LAG_REFERENCE, 0, 1) * MAX_STRETCH;
  return { angle: (Math.atan2(lagY, lagX) * 180) / Math.PI, sx, sy: 1 / sx };
}

export function clampLag(x: number, y: number) {
  const magnitude = Math.hypot(x, y);
  if (magnitude <= MAX_LAG) return { x, y };
  return { x: (x * MAX_LAG) / magnitude, y: (y * MAX_LAG) / magnitude };
}
