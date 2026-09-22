import type { Preset } from "../presets/presets";
import { clampRadius, type Shape } from "./shape";
import { uid } from "../utils/ids";

export function presetShapes(preset: Preset): Shape[] {
  return preset.shapes.map((s) => ({
    ...s,
    id: uid(),
    type: "roundedRect",
    radius: clampRadius(s.radius, s.width, s.height),
    rotation: 0,
    locked: false,
    hidden: false,
  }));
}
