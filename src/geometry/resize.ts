import type { Rect } from "./bounds";
import { MIN_SIZE } from "../model/shape";

export type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export const HANDLES: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

type ResizeModifiers = {
  preserveAspect: boolean;
  fromCenter: boolean;
};

const movesLeft = (h: ResizeHandle) => h.includes("w");
const movesRight = (h: ResizeHandle) => h.includes("e");
const movesTop = (h: ResizeHandle) => h.includes("n");
const movesBottom = (h: ResizeHandle) => h.includes("s");

export function resizeRect(
  start: Rect,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  mods: ResizeModifiers,
  minSize = MIN_SIZE,
): Rect {
  const cx = start.x + start.width / 2;
  const cy = start.y + start.height / 2;

  let width = start.width;
  let height = start.height;

  const factor = mods.fromCenter ? 2 : 1;

  if (movesRight(handle)) width = start.width + dx * factor;
  if (movesLeft(handle)) width = start.width - dx * factor;
  if (movesBottom(handle)) height = start.height + dy * factor;
  if (movesTop(handle)) height = start.height - dy * factor;

  if (mods.preserveAspect && start.width > 0 && start.height > 0) {
    const ratio = start.width / start.height;
    const changesX = movesLeft(handle) || movesRight(handle);
    const changesY = movesTop(handle) || movesBottom(handle);
    if (changesX && changesY) {
      const scale = Math.max(width / start.width, height / start.height);
      width = start.width * scale;
      height = start.height * scale;
    } else if (changesX) {
      height = width / ratio;
    } else if (changesY) {
      width = height * ratio;
    }
  }

  width = Math.max(minSize, width);
  height = Math.max(minSize, height);

  if (mods.fromCenter) {
    return { x: cx - width / 2, y: cy - height / 2, width, height };
  }

  // Anchor the opposite edge(s); a preserved aspect on an edge handle grows
  // symmetrically on the axis the pointer is not driving.
  let x: number;
  if (movesLeft(handle)) x = start.x + start.width - width;
  else if (movesRight(handle)) x = start.x;
  else x = cx - width / 2;

  let y: number;
  if (movesTop(handle)) y = start.y + start.height - height;
  else if (movesBottom(handle)) y = start.y;
  else y = cy - height / 2;

  return { x, y, width, height };
}

export function handleCursor(handle: ResizeHandle): string {
  switch (handle) {
    case "n":
    case "s":
      return "ns-resize";
    case "e":
    case "w":
      return "ew-resize";
    case "ne":
    case "sw":
      return "nesw-resize";
    case "nw":
    case "se":
      return "nwse-resize";
  }
}

export function handlePosition(rect: Rect, handle: ResizeHandle) {
  const x = movesLeft(handle) ? rect.x : movesRight(handle) ? rect.x + rect.width : rect.x + rect.width / 2;
  const y = movesTop(handle) ? rect.y : movesBottom(handle) ? rect.y + rect.height : rect.y + rect.height / 2;
  return { x, y };
}
