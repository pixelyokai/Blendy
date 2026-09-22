import { create } from "zustand";
import { CANVAS, createEmptyDocument, isColor, parseDocument, type GooDocument } from "../model/document";
import { blueprintFor, clampRadius, MIN_SIZE, type Shape, type ShapeType } from "../model/shape";
import { generateComposition } from "../presets/generate";
import { presetShapes } from "../model/preset";
import { getPreset } from "../presets/presets";
import { uid } from "../utils/ids";
import { clamp } from "../utils/clamp";
import { keepInside, shapesBounds, type Rect } from "../geometry/bounds";
import { rotatedBounds } from "../geometry/rotate";
import type { ResizeHandle } from "../geometry/resize";
import { useUi } from "./uiStore";

const MAX_HISTORY = 100;
const STORAGE_KEY = "blendy.document";
const CLIPBOARD_TAG = "blendy/shapes";
export const MAX_ZOOM = 3;

export type Point = { x: number; y: number };
export type Align = "left" | "right" | "top" | "bottom" | "hcenter" | "vcenter";

type Interaction =
  | { mode: "idle" }
  | { mode: "dragging"; startPointer: Point; startShapes: Shape[] }
  | {
      mode: "resizing";
      handle: ResizeHandle;
      startPointer: Point;
      startShapes: Shape[];
      startBounds: Rect;
      /** Frame the handles live in: the shape angle for a single selection, 0 otherwise. */
      frame: number;
    }
  | { mode: "rotating"; startPointer: Point; startShapes: Shape[]; centre: Point; startAngle: number }
  | { mode: "radius"; startPointer: Point; startShapes: Shape[] }
  /** `base` is the selection kept when Shift extends it. */
  | { mode: "marquee"; startPointer: Point; base: string[] };

/** Zoom level 1-3 relative to the fitted artboard, and the canvas point at the view centre. */
export type Viewport = { level: number; cx: number; cy: number };
export type Toast = { id: string; kind: "success" | "error"; message: string } | null;

type State = {
  document: GooDocument;
  selection: string[];
  viewport: Viewport;
  interaction: Interaction;
  past: GooDocument[];
  future: GooDocument[];
  historyBase: GooDocument | null;
  toast: Toast;
};

type Actions = {
  insertShape: (type: ShapeType, at?: Point) => void;
  insertPreset: (presetId: string, at?: Point) => void;
  generate: () => void;
  clear: () => void;

  setSelection: (ids: string[]) => void;
  clearSelection: () => void;
  selectAll: () => void;

  duplicateSelection: () => void;
  deleteSelection: () => void;
  nudge: (dx: number, dy: number) => void;
  align: (mode: Align) => void;
  distribute: (axis: "h" | "v") => void;
  copySelection: () => string | null;
  paste: (text: string) => boolean;

  updateShape: (id: string, patch: Partial<Shape>, commit?: boolean) => void;
  replaceShapes: (shapes: Shape[]) => void;
  /** replaceShapes with an undo step. */
  commitShapes: (shapes: Shape[]) => void;

  setGoo: (amount: number, commit?: boolean) => void;
  setFill: (fill: string, commit?: boolean) => void;
  /** `null` returns the selection to the document fill. */
  setSelectionFill: (fill: string | null, commit?: boolean) => void;
  setPreviewBackground: (color: string) => void;

  beginTransaction: () => void;
  endTransaction: () => void;
  /** `base` is the document undo returns to; defaults to the current one. */
  beginInteraction: (interaction: Interaction, base?: GooDocument) => void;
  endInteraction: () => void;

  undo: () => void;
  redo: () => void;

  setViewport: (viewport: Partial<Viewport>) => void;
  zoomBy: (factor: number) => void;

  showToast: (message: string, kind?: "success" | "error") => void;
  dismissToast: () => void;
};

type EditorStore = State & Actions;

function withHistory(state: State, next: GooDocument): Partial<State> {
  return { past: [...state.past, state.document].slice(-MAX_HISTORY), document: next, future: [] };
}

/** Centre a group of shapes on `at`, giving them fresh ids. */
function placed(shapes: Shape[], at: Point): Shape[] {
  const box = shapesBounds(shapes);
  if (!box) return [];
  const dx = at.x - (box.x + box.width / 2);
  const dy = at.y - (box.y + box.height / 2);
  return shapes.map((s) => ({ ...s, id: uid(), x: Math.round(s.x + dx), y: Math.round(s.y + dy) }));
}

const CENTRE = { x: CANVAS / 2, y: CANVAS / 2 };
const initial = loadFromStorage() ?? { ...createEmptyDocument(), shapes: presetShapes(getPreset("totem")!) };

let lastPaste = { text: "", count: 0 };

export const useEditor = create<EditorStore>((set, get) => {
  const addShapes = (added: Shape[]) => {
    if (!added.length) return;
    // New shapes land on the artboard, however near its edge they were dropped.
    const box = shapesBounds(added);
    const { dx, dy } = box ? keepInside(box, 0, 0, CANVAS) : { dx: 0, dy: 0 };
    const shapes = added.map((s) => ({ ...s, x: s.x + dx, y: s.y + dy }));
    const state = get();
    const next = { ...state.document, shapes: [...state.document.shapes, ...shapes] };
    set({ ...withHistory(state, next), selection: shapes.map((s) => s.id) });
  };

  const moveSelected = (move: (s: Shape) => Partial<Shape> | null) => {
    const state = get();
    let changed = false;
    const shapes = state.document.shapes.map((s) => {
      if (!state.selection.includes(s.id) || s.locked) return s;
      const patch = move(s);
      if (!patch) return s;
      changed = true;
      return { ...s, ...patch };
    });
    if (changed) set(withHistory(state, { ...state.document, shapes }));
  };

  return {
    document: initial,
    selection: [],
    viewport: { level: 1, cx: CENTRE.x, cy: CENTRE.y },
    interaction: { mode: "idle" },
    past: [],
    future: [],
    historyBase: null,
    toast: null,

    insertShape: (type, at = CENTRE) => addShapes([blueprintFor(type, uid(), at.x, at.y)]),

    insertPreset: (presetId, at = CENTRE) => {
      const preset = getPreset(presetId);
      if (preset) addShapes(placed(presetShapes(preset), at));
    },

    generate: () => {
      const state = get();
      const next = { ...state.document, shapes: generateComposition(CANVAS, CANVAS) };
      set({ ...withHistory(state, next), selection: [] });
    },

    clear: () => {
      const state = get();
      if (!state.document.shapes.length) return;
      set({ ...withHistory(state, { ...state.document, shapes: [] }), selection: [] });
    },

    setSelection: (ids) => set({ selection: ids }),
    clearSelection: () => set({ selection: [] }),
    selectAll: () =>
      set((s) => ({ selection: s.document.shapes.filter((x) => !x.locked).map((x) => x.id) })),

    duplicateSelection: () => {
      const { document, selection } = get();
      addShapes(
        document.shapes
          .filter((s) => selection.includes(s.id))
          .map((s) => ({ ...s, id: uid(), x: s.x + 16, y: s.y + 16 })),
      );
    },

    deleteSelection: () => {
      const state = get();
      if (!state.selection.length) return;
      const shapes = state.document.shapes.filter((s) => !state.selection.includes(s.id));
      set({ ...withHistory(state, { ...state.document, shapes }), selection: [] });
    },

    nudge: (dx, dy) => {
      const { document, selection } = get();
      const box = shapesBounds(document.shapes.filter((s) => selection.includes(s.id) && !s.locked));
      if (box) ({ dx, dy } = keepInside(box, dx, dy, CANVAS));
      if (dx || dy) moveSelected((s) => ({ x: s.x + dx, y: s.y + dy }));
    },

    // One shape aligns to the artboard; several align to their shared bounds.
    align: (mode) => {
      const { document, selection } = get();
      const selected = document.shapes.filter((s) => selection.includes(s.id));
      const target =
        selected.length === 1 ? { x: 0, y: 0, width: CANVAS, height: CANVAS } : shapesBounds(selected);
      if (!target) return;
      moveSelected((s) => {
        const b = rotatedBounds(s);
        const dx =
          mode === "left" ? target.x - b.x
          : mode === "right" ? target.x + target.width - (b.x + b.width)
          : mode === "hcenter" ? target.x + (target.width - b.width) / 2 - b.x
          : 0;
        const dy =
          mode === "top" ? target.y - b.y
          : mode === "bottom" ? target.y + target.height - (b.y + b.height)
          : mode === "vcenter" ? target.y + (target.height - b.height) / 2 - b.y
          : 0;
        return Math.abs(dx) + Math.abs(dy) < 0.01 ? null : { x: s.x + dx, y: s.y + dy };
      });
    },

    distribute: (axis) => {
      const { document, selection } = get();
      const items = document.shapes
        .filter((s) => selection.includes(s.id))
        .map((s) => ({ s, b: rotatedBounds(s) }))
        .sort((a, b) => (axis === "h" ? a.b.x - b.b.x : a.b.y - b.b.y));
      if (items.length < 3) return;
      const size = (b: Rect) => (axis === "h" ? b.width : b.height);
      const start = axis === "h" ? items[0].b.x : items[0].b.y;
      const last = items[items.length - 1].b;
      const end = axis === "h" ? last.x + last.width : last.y + last.height;
      const gap = (end - start - items.reduce((sum, i) => sum + size(i.b), 0)) / (items.length - 1);
      const offsets = new Map<string, number>();
      let cursor = start;
      for (const { s, b } of items) {
        offsets.set(s.id, cursor - (axis === "h" ? b.x : b.y));
        cursor += size(b) + gap;
      }
      moveSelected((s) => {
        const d = offsets.get(s.id) ?? 0;
        return axis === "h" ? { x: s.x + d } : { y: s.y + d };
      });
    },

    copySelection: () => {
      const { document, selection } = get();
      const shapes = document.shapes.filter((s) => selection.includes(s.id));
      return shapes.length ? JSON.stringify({ type: CLIPBOARD_TAG, shapes }) : null;
    },

    paste: (text) => {
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        return false;
      }
      if ((data as { type?: string })?.type !== CLIPBOARD_TAG) return false;
      // Clipboard contents are untrusted: they go through the same sanitiser as storage.
      const shapes = parseDocument(data)?.shapes ?? [];
      lastPaste = { text, count: lastPaste.text === text ? lastPaste.count + 1 : 1 };
      const offset = 16 * lastPaste.count;
      addShapes(shapes.map((s) => ({ ...s, id: uid(), x: s.x + offset, y: s.y + offset })));
      return shapes.length > 0;
    },

    updateShape: (id, patch, commit = true) => {
      const state = get();
      const shapes = state.document.shapes.map((s) => {
        if (s.id !== id) return s;
        const merged = { ...s, ...patch };
        merged.width = Math.max(MIN_SIZE, merged.width);
        merged.height = Math.max(MIN_SIZE, merged.height);
        merged.radius = clampRadius(merged.radius, merged.width, merged.height);
        return merged;
      });
      const next = { ...state.document, shapes };
      set(commit ? withHistory(state, next) : { document: next });
    },

    replaceShapes: (shapes) => set((s) => ({ document: { ...s.document, shapes } })),
    commitShapes: (shapes) => set((s) => withHistory(s, { ...s.document, shapes })),

    setGoo: (amount, commit = true) => {
      const state = get();
      const next = { ...state.document, goo: { amount } };
      set(commit ? withHistory(state, next) : { document: next });
    },

    setFill: (fill, commit = true) => {
      const state = get();
      if (!isColor(fill)) return;
      const next = { ...state.document, appearance: { ...state.document.appearance, fill } };
      set(commit ? withHistory(state, next) : { document: next });
    },

    setSelectionFill: (fill, commit = true) => {
      const state = get();
      if (fill !== null && !isColor(fill)) return;
      const shapes = state.document.shapes.map((s) => {
        if (!state.selection.includes(s.id)) return s;
        const { fill: _, ...rest } = s;
        return fill === null ? rest : { ...rest, fill };
      });
      const next = { ...state.document, shapes };
      set(commit ? withHistory(state, next) : { document: next });
    },

    setPreviewBackground: (color) =>
      set((s) =>
        isColor(color)
          ? { document: { ...s.document, appearance: { ...s.document.appearance, previewBackground: color } } }
          : s,
      ),

    beginTransaction: () => set((s) => ({ historyBase: s.historyBase ?? s.document })),
    endTransaction: () => {
      const { historyBase, document, past } = get();
      if (!historyBase) return;
      set(
        historyBase === document
          ? { historyBase: null }
          : { past: [...past, historyBase].slice(-MAX_HISTORY), future: [], historyBase: null },
      );
    },

    beginInteraction: (interaction, base) =>
      set((s) => ({ interaction, historyBase: base ?? s.document })),
    endInteraction: () => {
      const { historyBase, document, past } = get();
      set(
        historyBase && historyBase !== document
          ? { past: [...past, historyBase].slice(-MAX_HISTORY), future: [], historyBase: null, interaction: { mode: "idle" } }
          : { historyBase: null, interaction: { mode: "idle" } },
      );
    },

    undo: () => {
      const state = get();
      const previous = state.past[state.past.length - 1];
      if (!previous) return;
      set({
        past: state.past.slice(0, -1),
        document: previous,
        future: [state.document, ...state.future].slice(0, MAX_HISTORY),
        selection: state.selection.filter((id) => previous.shapes.some((sh) => sh.id === id)),
      });
    },

    redo: () => {
      const state = get();
      const next = state.future[0];
      if (!next) return;
      set({
        past: [...state.past, state.document].slice(-MAX_HISTORY),
        document: next,
        future: state.future.slice(1),
        selection: state.selection.filter((id) => next.shapes.some((sh) => sh.id === id)),
      });
    },

    setViewport: (viewport) =>
      set((s) => {
        const next = { ...s.viewport, ...viewport };
        return { viewport: { ...next, level: clamp(next.level, 1, MAX_ZOOM) } };
      }),
    zoomBy: (factor) => get().setViewport({ level: get().viewport.level * factor }),

    showToast: (message, kind = "error") => set({ toast: { id: uid("t"), kind, message } }),
    dismissToast: () => set({ toast: null }),
  };
});

export function saveToStorage(doc: GooDocument) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
  } catch {
    /* private mode or quota: autosave is best effort */
  }
}

function loadFromStorage(): GooDocument | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? parseDocument(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** The artboard follows the theme until someone picks their own background. */
const THEME_BACKGROUND = { light: "#ffffff", dark: "#262626" };
function followTheme() {
  const theme = useUi.getState().theme;
  const { document, setPreviewBackground } = useEditor.getState();
  const current = document.appearance.previewBackground.toLowerCase();
  if (Object.values(THEME_BACKGROUND).includes(current) && current !== THEME_BACKGROUND[theme]) setPreviewBackground(THEME_BACKGROUND[theme]);
}
followTheme();
useUi.subscribe((s, prev) => s.theme !== prev.theme && followTheme());
