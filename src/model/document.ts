import { clampInnerRatio, clampPoints, clampRadius, clampSides, MIN_SIZE, normalizeRotation, SHAPE_BLUEPRINTS, type Shape, type ShapeType } from "./shape";
import { uid } from "../utils/ids";

/** The artboard is fixed; the editor is a fixed frame, not an infinite canvas. */
export const CANVAS = 1000;

const DEFAULT_FILL = "#CBDE00";

export type GooDocument = {
  version: 2;
  appearance: { fill: string; previewBackground: string };
  goo: { amount: number };
  shapes: Shape[];
};

export function createEmptyDocument(): GooDocument {
  return {
    version: 2,
    appearance: { fill: DEFAULT_FILL, previewBackground: "#ffffff" },
    goo: { amount: 50 },
    shapes: [],
  };
}

export const isColor = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{3,8}$/i.test(value);

const num = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

/**
 * Rebuilds a document from untrusted JSON. Anything missing or out of range is
 * replaced rather than trusted, so a corrupted save cannot crash the editor.
 */
export function parseDocument(raw: unknown): GooDocument | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Record<string, any>;
  if (!Array.isArray(input.shapes)) return null;

  const base = createEmptyDocument();
  const types = Object.keys(SHAPE_BLUEPRINTS) as ShapeType[];

  const shapes = input.shapes.slice(0, 200).flatMap((raw: unknown): Shape[] => {
    const item = raw as Record<string, unknown>;
    if (!item || typeof item !== "object" || !types.includes(item.type as ShapeType)) return [];
    const width = Math.max(MIN_SIZE, num(item.width, 100));
    const height = Math.max(MIN_SIZE, num(item.height, 100));
    return [
      {
        id: typeof item.id === "string" ? item.id : uid(),
        type: item.type as ShapeType,
        x: num(item.x, 0),
        y: num(item.y, 0),
        width,
        height,
        radius: clampRadius(num(item.radius, 0), width, height),
        rotation: normalizeRotation(num(item.rotation, 0)),
        ...(item.sides !== undefined ? { sides: clampSides(num(item.sides, 6)) } : {}),
        ...(item.points !== undefined ? { points: clampPoints(num(item.points, 5)) } : {}),
        ...(item.innerRatio !== undefined
          ? { innerRatio: clampInnerRatio(num(item.innerRatio, 0.45)) }
          : {}),
        ...(isColor(item.fill) ? { fill: item.fill } : {}),
        locked: item.locked === true,
        hidden: item.hidden === true,
      },
    ];
  });

  return {
    version: 2,
    appearance: {
      fill: isColor(input.appearance?.fill) ? input.appearance.fill : base.appearance.fill,
      previewBackground: isColor(input.appearance?.previewBackground)
        ? input.appearance.previewBackground
        : base.appearance.previewBackground,
    },
    goo: { amount: Math.max(0, Math.min(100, num(input.goo?.amount, 50))) },
    shapes,
  };
}
