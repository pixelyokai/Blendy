import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { Shape } from "../model/shape";
import { needsEvenOdd, shapePath } from "../geometry/shapePath";
import { rotationTransform } from "../geometry/rotate";

type Props = {
  shape: Shape;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  pointerEvents?: "all" | "none";
  style?: CSSProperties;
  onPointerDown?: (event: ReactPointerEvent) => void;
};

/** One source primitive, used for hit targets and selection outlines. */
export function ShapeNode({ shape, ...rest }: Props) {
  return (
    <path
      d={shapePath(shape)}
      fillRule={needsEvenOdd(shape.type) ? "evenodd" : undefined}
      transform={rotationTransform(shape) ?? undefined}
      {...rest}
    />
  );
}
