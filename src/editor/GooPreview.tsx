import { useMemo } from "react";
import type { Preset } from "../presets/presets";
import { presetShapes } from "../model/preset";
import { shapesBounds } from "../geometry/bounds";
import { smoothFor } from "../goo/mapping";
import { gooOutline } from "../goo/trace";

/** A preset thumbnail, traced by the same outline as the canvas. */
export function GooPreview({ preset }: { preset: Preset }) {
  const art = useMemo(() => {
    const shapes = presetShapes(preset);
    const box = shapesBounds(shapes);
    if (!box) return null;
    const { d, bounds } = gooOutline({ shapes, smooth: smoothFor(50), cell: Math.max(box.width, box.height) / 70 });
    const b = bounds ?? box;
    const pad = Math.max(b.width, b.height) * 0.08;
    return { d, viewBox: `${b.x - pad} ${b.y - pad} ${b.width + pad * 2} ${b.height + pad * 2}` };
  }, [preset]);

  if (!art) return null;
  return (
    <svg className="goo-preview" viewBox={art.viewBox} aria-hidden="true">
      <path d={art.d} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
