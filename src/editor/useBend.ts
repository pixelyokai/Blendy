import { useCallback, useEffect, useRef } from "react";
import { clampLag } from "../geometry/bend";

// Steady-state lag during a drag is 2*zeta*velocity/omega, so stiffness is what
// keeps the block near the pointer. zeta ~0.5 leaves one small overshoot on
// release and settles in about 150ms.
const STIFFNESS = 1800;
const DAMPING = 42;
const SUBSTEP = 1 / 240;
const REST = 0.1;

type BendValue = { x: number; y: number; ids: string[] };
const IDLE: BendValue = { x: 0, y: 0, ids: [] };

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/**
 * How far the rendered blocks trail the real ones during a drag. Movement pushes
 * the lag out; an under-damped spring pulls it back, giving the settle on release.
 * Lives in refs and calls `onFrame` instead of setting state, so the spring never
 * re-renders React - it only redraws the goo.
 */
export function useBend(onFrame: () => void) {
  const value = useRef<BendValue>(IDLE);
  const velocity = useRef({ x: 0, y: 0 });
  const frame = useRef(0);
  const last = useRef(0);
  const notify = useRef(onFrame);
  notify.current = onFrame;

  const tick = useCallback((now: number) => {
    const elapsed = Math.min((now - last.current) / 1000, 1 / 20);
    last.current = now;
    const v = value.current;
    let { x, y } = v;
    for (let t = 0; t < elapsed; t += SUBSTEP) {
      const dt = Math.min(SUBSTEP, elapsed - t);
      velocity.current.x += (-STIFFNESS * x - DAMPING * velocity.current.x) * dt;
      velocity.current.y += (-STIFFNESS * y - DAMPING * velocity.current.y) * dt;
      x += velocity.current.x * dt;
      y += velocity.current.y * dt;
    }
    const settled = Math.hypot(x, y) < REST && Math.hypot(velocity.current.x, velocity.current.y) < REST;
    value.current = settled ? IDLE : { x, y, ids: v.ids };
    frame.current = settled ? 0 : requestAnimationFrame(tick);
    if (settled) velocity.current = { x: 0, y: 0 };
    notify.current();
  }, []);

  const push = useCallback(
    (dx: number, dy: number, ids: string[]) => {
      if (reducedMotion() || !ids.length) return;
      value.current = { ...clampLag(value.current.x + dx, value.current.y + dy), ids };
      if (!frame.current) {
        last.current = performance.now();
        frame.current = requestAnimationFrame(tick);
      }
    },
    [tick],
  );

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    },
    [],
  );
  return { bend: value, push };
}
