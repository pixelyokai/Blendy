import { useMemo } from "react";
import { CANVAS } from "../model/document";
import type { Rect } from "../geometry/bounds";

const RULER = 20;
const STEPS = [10, 25, 50, 100, 250, 500];

type Props = {
  axis: "x" | "y";
  /** Viewport length along this axis, in screen px. */
  length: number;
  scale: number;
  offset: number;
  selection: Rect | null;
};

/** Artboard coordinates along one edge, with the selection's span highlighted. */
export function Ruler({ axis, length, scale, offset, selection }: Props) {
  const horizontal = axis === "x";
  const toScreen = (v: number) => offset + v * scale;

  // Ticks only change with zoom and scroll, not with every shape move.
  const ticks = useMemo(() => {
    const major = STEPS.find((s) => s * scale >= 64) ?? 500;
    const out: JSX.Element[] = [];
    for (let v = 0; v <= CANVAS; v += major / 5) {
      const p = Math.round(offset + v * scale) + 0.5;
      if (p < 0 || p > length) continue;
      const size = v % major === 0 ? 8 : 4;
      out.push(
        horizontal ? (
          <line key={v} x1={p} x2={p} y1={RULER - size} y2={RULER} />
        ) : (
          <line key={v} y1={p} y2={p} x1={RULER - size} x2={RULER} />
        ),
      );
      if (v % major === 0)
        out.push(
          horizontal ? (
            <text key={`t${v}`} x={p + 3} y={10}>{v}</text>
          ) : (
            <text key={`t${v}`} transform={`translate(10 ${p - 3}) rotate(-90)`}>{v}</text>
          ),
        );
    }
    return out;
  }, [scale, offset, length, horizontal]);

  const span =
    selection &&
    (horizontal
      ? [toScreen(selection.x), toScreen(selection.x + selection.width)]
      : [toScreen(selection.y), toScreen(selection.y + selection.height)]);

  return (
    <svg
      className={`ruler ruler-${axis}`}
      width={horizontal ? length : RULER}
      height={horizontal ? RULER : length}
      aria-hidden="true"
    >
      {span &&
        (horizontal ? (
          <rect className="ruler-span" x={span[0]} y={0} width={span[1] - span[0]} height={RULER} />
        ) : (
          <rect className="ruler-span" x={0} y={span[0]} width={RULER} height={span[1] - span[0]} />
        ))}
      <g className="ruler-ticks">{ticks}</g>
    </svg>
  );
}
