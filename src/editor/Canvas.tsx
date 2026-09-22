import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { MAX_ZOOM, useEditor, type Point } from "../state/editorStore";
import { CANVAS } from "../model/document";
import { intersects, keepInside, shapesBounds, type Rect } from "../geometry/bounds";
import { smoothFor } from "../goo/mapping";
import { FILLET_SCALE, gooOutline, type Outline, type OutlineInput } from "../goo/trace";
import { HANDLES, handleCursor, handlePosition, resizeRect, type ResizeHandle } from "../geometry/resize";
import { mapShapeToBounds } from "../geometry/transforms";
import {
  clampRadius,
  MIN_SIZE,
  normalizeRotation,
  SHAPE_BLUEPRINTS,
  supportsRadius,
  type Shape,
  type ShapeType,
} from "../model/shape";
import { clamp } from "../utils/clamp";
import { uid } from "../utils/ids";
import { bendParams } from "../geometry/bend";
import { rectCenter, rotateAbout, rotatedBounds, rotateVec, shapeCenter, toDegrees, withCenter } from "../geometry/rotate";
import { snap, type Guide } from "../geometry/snap";
import { useBend } from "./useBend";
import { ShapeNode } from "./ShapeNode";
import { Ruler } from "./Rulers";
import { useUi } from "../state/uiStore";

/** Screen px kept around the artboard at 100%. */
const MARGIN = 40;
const SNAP_PX = 6;
const ACCENT = "#2e7cf6";
const GUIDE = "#f24822";
const ARTBOARD = { x: 0, y: 0, width: CANVAS, height: CANVAS };
export const DRAG_TYPE = "application/x-blendy";

/** Keeps the view on the artboard: centred at 100%, scrollable only up to its edges when zoomed. */
function clampCentre(c: number, visible: number, scale: number) {
  const half = visible / 2 / scale;
  const slack = MARGIN / scale;
  const lo = half - slack;
  const hi = CANVAS - half + slack;
  return lo >= hi ? CANVAS / 2 : clamp(c, lo, hi);
}

export function Canvas() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [guides, setGuides] = useState<Guide[]>([]);
  const [altDown, setAltDown] = useState(false);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const marqueeStarted = useRef(false);

  const doc = useEditor((s) => s.document);
  const selection = useEditor((s) => s.selection);
  const viewport = useEditor((s) => s.viewport);
  const interaction = useEditor((s) => s.interaction);
  const rulers = useUi((s) => s.rulers);
  const pixelGrid = useUi((s) => s.pixelGrid);

  const gooRef = useRef<SVGGElement>(null);
  const overlayRef = useRef<SVGGElement>(null);
  const sourcesRef = useRef<SVGGElement>(null);
  const redraw = useRef(() => {});
  const { bend, push: pushBend } = useBend(() => redraw.current());
  const snapCache = useRef<{ for: unknown; targets: Rect[] }>({ for: null, targets: [] });
  const guideKey = useRef("");

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const read = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    const observer = new ResizeObserver(read);
    observer.observe(el);
    read();
    return () => observer.disconnect();
  }, []);

  const fit = Math.max(0.05, Math.min((size.width - MARGIN * 2) / CANVAS, (size.height - MARGIN * 2) / CANVAS));
  const scale = fit * viewport.level;
  const cx = clampCentre(viewport.cx, size.width, scale);
  const cy = clampCentre(viewport.cy, size.height, scale);
  const panX = size.width / 2 - cx * scale;
  const panY = size.height / 2 - cy * scale;

  // Event handlers read the latest view without re-subscribing every render.
  const view = useRef({ fit, scale, cx, cy, panX, panY, ...size });
  view.current = { fit, scale, cx, cy, panX, panY, ...size };

  const toLogical = useCallback((event: { clientX: number; clientY: number }): Point => {
    const rect = viewportRef.current?.getBoundingClientRect();
    const v = view.current;
    if (!rect) return { x: 0, y: 0 };
    return { x: (event.clientX - rect.left - v.panX) / v.scale, y: (event.clientY - rect.top - v.panY) / v.scale };
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const v = view.current;
      const store = useEditor.getState();
      if (event.ctrlKey || event.metaKey) {
        // Zoom about the pointer: the canvas point under it stays put.
        const rect = el.getBoundingClientRect();
        const px = event.clientX - rect.left;
        const py = event.clientY - rect.top;
        const anchor = { x: (px - v.panX) / v.scale, y: (py - v.panY) / v.scale };
        const level = clamp(store.viewport.level * Math.exp(-event.deltaY / 300), 1, MAX_ZOOM);
        const next = v.fit * level;
        store.setViewport({
          level,
          cx: clampCentre(anchor.x - (px - v.width / 2) / next, v.width, next),
          cy: clampCentre(anchor.y - (py - v.height / 2) / next, v.height, next),
        });
      } else {
        store.setViewport({
          cx: clampCentre(v.cx + event.deltaX / v.scale, v.width, v.scale),
          cy: clampCentre(v.cy + event.deltaY / v.scale, v.height, v.scale),
        });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => setAltDown(e.altKey);
    const reset = () => setAltDown(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", reset);
    };
  }, []);

  // Window-level so a gesture survives the pointer leaving the canvas; one
  // history entry is committed on release.
  useEffect(() => {
    if (interaction.mode === "idle") return;

    const onMove = (event: PointerEvent) => {
      const store = useEditor.getState();
      const current = store.interaction;
      if (current.mode === "idle") return;

      const pointer = toLogical(event);
      let dx = pointer.x - current.startPointer.x;
      let dy = pointer.y - current.startPointer.y;

      if (current.mode === "dragging") {
        const ids = new Set(current.startShapes.map((s) => s.id));
        const box = shapesBounds(current.startShapes);
        let next: Guide[] = [];
        if (box && !event.ctrlKey && !event.metaKey) {
          // Everything else stands still during a drag, so its edges are gathered once.
          if (snapCache.current.for !== current) {
            snapCache.current = {
              for: current,
              targets: [
                ...store.document.shapes.filter((s) => !ids.has(s.id) && !s.hidden).map(rotatedBounds),
                ARTBOARD,
              ],
            };
          }
          const snapped = snap({ ...box, x: box.x + dx, y: box.y + dy }, snapCache.current.targets, SNAP_PX / view.current.scale);
          dx += snapped.dx;
          dy += snapped.dy;
          next = snapped.guides;
        }
        // On the pixel grid a drag lands on whole units.
        if (box && useUi.getState().pixelGrid) {
          dx = Math.round(box.x + dx) - box.x;
          dy = Math.round(box.y + dy) - box.y;
        }
        if (box) ({ dx, dy } = keepInside(box, dx, dy, CANVAS));
        const key = next.map((g) => `${g.axis}${g.at}:${g.from}:${g.to}`).join("|");
        if (key !== guideKey.current) {
          guideKey.current = key;
          setGuides(next);
        }
        // Feed the movement to the bend spring so the render trails the pointer.
        const first = current.startShapes[0];
        const previous = store.document.shapes.find((s) => s.id === first.id);
        if (previous) pushBend(first.x + dx - previous.x, first.y + dy - previous.y, [...ids]);
        const moved = new Map(current.startShapes.map((s) => [s.id, { ...s, x: s.x + dx, y: s.y + dy }]));
        store.replaceShapes(store.document.shapes.map((s) => moved.get(s.id) ?? s));
        return;
      }

      if (current.mode === "marquee") {
        const box = {
          x: Math.min(current.startPointer.x, pointer.x),
          y: Math.min(current.startPointer.y, pointer.y),
          width: Math.abs(dx),
          height: Math.abs(dy),
        };
        // A few pixels of travel before it counts, so a click still just deselects.
        if (!marqueeStarted.current && Math.max(box.width, box.height) * view.current.scale < 3) return;
        marqueeStarted.current = true;
        setMarquee(box);
        const hits = store.document.shapes
          .filter((s) => !s.hidden && !s.locked && intersects(rotatedBounds(s), box))
          .map((s) => s.id);
        const next = [...new Set([...current.base, ...hits])];
        if (next.join() !== store.selection.join()) store.setSelection(next);
        return;
      }

      if (current.mode === "radius") {
        const base = current.startShapes[0];
        const radius = clampRadius(base.radius + dx, base.width, base.height);
        store.replaceShapes(store.document.shapes.map((s) => (s.id === base.id ? { ...s, radius } : s)));
        return;
      }

      if (current.mode === "rotating") {
        let delta = toDegrees(Math.atan2(pointer.y - current.centre.y, pointer.x - current.centre.x)) - current.startAngle;
        if (event.shiftKey) delta = Math.round(delta / 15) * 15;
        // Spin on own centre and orbit the selection centre: a rigid group turn.
        const turned = new Map(
          current.startShapes.map((s) => [
            s.id,
            withCenter({ ...s, rotation: normalizeRotation(s.rotation + delta) }, rotateAbout(shapeCenter(s), current.centre, delta)),
          ]),
        );
        store.replaceShapes(store.document.shapes.map((s) => turned.get(s.id) ?? s));
        return;
      }

      // Resizing: handles live in the shape frame, so take the delta back into it.
      const local = rotateVec({ x: dx, y: dy }, -current.frame);
      const next = resizeRect(
        current.startBounds,
        current.handle,
        local.x,
        local.y,
        { preserveAspect: event.shiftKey, fromCenter: event.altKey },
        current.startShapes.length === 1 ? MIN_SIZE : 1,
      );
      const origin = rectCenter(current.startBounds);
      // An anchored edge moves the centre along a rotated axis.
      const shift = rotateVec({ x: rectCenter(next).x - origin.x, y: rectCenter(next).y - origin.y }, current.frame);
      const mapped = new Map(
        current.startShapes.map((s) => {
          const resized = mapShapeToBounds(s, current.startBounds, next);
          return [s.id, current.frame ? withCenter(resized, { x: origin.x + shift.x, y: origin.y + shift.y }) : resized];
        }),
      );
      store.replaceShapes(store.document.shapes.map((s) => mapped.get(s.id) ?? s));
    };

    const onUp = () => {
      marqueeStarted.current = false;
      setMarquee(null);
      useEditor.getState().endInteraction();
      guideKey.current = "";
      setGuides([]);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [interaction.mode, toLogical, pushBend]);

  const beginShapeDrag = (event: React.PointerEvent, shape: Shape) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const store = useEditor.getState();
    let ids = store.selection;
    if (event.shiftKey) {
      ids = ids.includes(shape.id) ? ids.filter((i) => i !== shape.id) : [...ids, shape.id];
      store.setSelection(ids);
      if (!ids.includes(shape.id)) return;
    } else if (!ids.includes(shape.id)) {
      ids = [shape.id];
      store.setSelection(ids);
    }
    const base = store.document;
    let startShapes = base.shapes.filter((s) => ids.includes(s.id) && !s.locked);
    if (!startShapes.length) return;

    // Alt-drag leaves the originals and drags copies; undo removes the copies too.
    if (event.altKey) {
      startShapes = startShapes.map((s) => ({ ...s, id: uid() }));
      store.replaceShapes([...base.shapes, ...startShapes]);
      store.setSelection(startShapes.map((s) => s.id));
    }
    store.beginInteraction({ mode: "dragging", startPointer: toLogical(event), startShapes }, base);
  };

  const selectedShapes = () => {
    const store = useEditor.getState();
    return store.document.shapes.filter((s) => store.selection.includes(s.id) && !s.locked);
  };

  const beginResize = (event: React.PointerEvent, handle: ResizeHandle) => {
    event.stopPropagation();
    if (event.button !== 0) return;
    const startShapes = selectedShapes();
    // Single shape resizes in its own frame; a mixed selection uses an upright box.
    const single = startShapes.length === 1 ? startShapes[0] : null;
    const frame = single?.rotation ?? 0;
    const startBounds = single
      ? { x: single.x, y: single.y, width: single.width, height: single.height }
      : shapesBounds(startShapes);
    if (!startBounds) return;
    useEditor
      .getState()
      .beginInteraction({ mode: "resizing", handle, startPointer: toLogical(event), startShapes, startBounds, frame });
  };

  const beginRotate = (event: React.PointerEvent) => {
    event.stopPropagation();
    if (event.button !== 0) return;
    const startShapes = selectedShapes();
    const box = shapesBounds(startShapes);
    if (!box) return;
    const centre = rectCenter(box);
    const pointer = toLogical(event);
    useEditor.getState().beginInteraction({
      mode: "rotating",
      startPointer: pointer,
      startShapes,
      centre,
      startAngle: toDegrees(Math.atan2(pointer.y - centre.y, pointer.x - centre.x)),
    });
  };

  const beginRadius = (event: React.PointerEvent, shape: Shape) => {
    event.stopPropagation();
    if (event.button !== 0) return;
    useEditor.getState().beginInteraction({ mode: "radius", startPointer: toLogical(event), startShapes: [shape] });
  };

  const onDrop = (event: React.DragEvent) => {
    const raw = event.dataTransfer.getData(DRAG_TYPE);
    if (!raw) return;
    event.preventDefault();
    const p = toLogical(event);
    const at = { x: clamp(p.x, 0, CANVAS), y: clamp(p.y, 0, CANVAS) };
    const item = JSON.parse(raw) as { kind?: string; id?: string };
    const store = useEditor.getState();
    if (item.kind === "shape" && item.id && item.id in SHAPE_BLUEPRINTS) store.insertShape(item.id as ShapeType, at);
    else if (item.kind === "preset" && item.id) store.insertPreset(item.id, at);
  };

  /**
   * The goo is traced outside React and written straight to the path: at most
   * once per frame, coarse while anything moves, sharp once it has been still
   * for a moment. Painted geometry trails the real geometry by the bend lag;
   * hit targets use the real geometry, so what you grab is where you let go.
   */
  const timers = useRef({ frame: 0, fine: 0 });
  const jobs = useRef(0);
  const worker = useRef<Worker | null>(null);

  const paint = useCallback((parts: Outline["parts"], fine: boolean) => {
    const layer = gooRef.current;
    if (!layer) return;
    while (layer.children.length > parts.length) layer.lastElementChild!.remove();
    parts.forEach((part, i) => {
      const el = layer.children[i] ?? layer.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "path"));
      el.setAttribute("d", part.d);
      el.setAttribute("fill", part.fill);
    });
    // At rest the traced outline is exact on its own and carries the whole silhouette,
    // so there is no seam; the vectors only cover for coarse sampling while moving.
    sourcesRef.current?.setAttribute("visibility", fine && parts.some((p) => p.d) ? "hidden" : "visible");
  }, []);

  useEffect(() => {
    try {
      const w = new Worker(new URL("../goo/worker.ts", import.meta.url), { type: "module" });
      // Anything drawn since the job was posted makes its result stale.
      w.onmessage = (e: MessageEvent<{ job: number; parts: Outline["parts"] }>) => {
        if (e.data.job === jobs.current) paint(e.data.parts, true);
      };
      worker.current = w;
      return () => {
        w.terminate();
        worker.current = null;
      };
    } catch {
      /* no workers: the sharp pass runs on the main thread */
    }
  }, [paint]);

  const draw = useCallback((fine: boolean) => {
    const v = view.current;
    if (!gooRef.current || !v.width) return;
    const { shapes, goo, appearance } = useEditor.getState().document;
    const { x, y, ids } = bend.current;
    const bending = new Set(ids);
    const painted = shapes
      .filter((s) => !s.hidden)
      .map((s) => (bending.has(s.id) ? { ...s, x: s.x - x, y: s.y - y } : s));
    const smooth = smoothFor(goo.amount);
    const params = bending.size ? bendParams(x, y) : null;

    // With no goo there is nothing to trace: the exact vectors are the artwork.
    // Sampling follows the goo's scale, so zooming in doesn't multiply the work;
    // the sharp pass is fine enough that corners and tips hold their shape.
    const job = ++jobs.current;
    const pad = smooth * FILLET_SCALE + 24 / v.scale;
    const smoothPx = smooth * FILLET_SCALE * v.scale;
    const input: OutlineInput | null =
      smooth >= 1
        ? {
            shapes: painted,
            bend: params ? { ids: bending, ...params } : null,
            smooth,
            cell: (fine ? clamp(smoothPx / 30, 1, 1.5) : clamp(smoothPx / 10, 2, 6)) / v.scale,
            clip: { x: -v.panX / v.scale - pad, y: -v.panY / v.scale - pad, width: v.width / v.scale + pad * 2, height: v.height / v.scale + pad * 2 },
            defaultFill: appearance.fill,
            precise: fine,
          }
        : null;
    // The coarse result stays up until the worker's sharp one lands.
    if (fine && input && worker.current) worker.current.postMessage({ job, input });
    else paint(input ? gooOutline(input).parts : [], fine);

    // Dragged shapes trail the pointer by the lag and stretch along their travel.
    const lag = `translate(${-x} ${-y})`;
    const byId = new Map(shapes.map((s) => [s.id, s]));
    for (const el of Array.from(sourcesRef.current?.children ?? [])) {
      const shape = byId.get((el as SVGGElement).dataset.id ?? "");
      if (!shape || !bending.has(shape.id)) {
        el.removeAttribute("transform");
        continue;
      }
      const c = shapeCenter(shape);
      const stretch = params
        ? ` translate(${c.x} ${c.y}) rotate(${params.angle}) scale(${params.sx} ${params.sy}) rotate(${-params.angle}) translate(${-c.x} ${-c.y})`
        : "";
      el.setAttribute("transform", lag + stretch);
    }
    if (bending.size) overlayRef.current?.setAttribute("transform", lag);
    else overlayRef.current?.removeAttribute("transform");
  }, [bend, paint]);

  redraw.current = () => {
    const t = timers.current;
    if (!t.frame) {
      t.frame = requestAnimationFrame(() => {
        t.frame = 0;
        draw(false);
      });
    }
    clearTimeout(t.fine);
    t.fine = window.setTimeout(() => requestAnimationFrame(() => draw(true)), 140);
  };

  useEffect(() => useEditor.subscribe((s, prev) => s.document !== prev.document && redraw.current()), []);
  useEffect(() => redraw.current(), [scale, panX, panY, size.width, size.height]);
  useEffect(() => {
    const t = timers.current;
    return () => {
      // Reset the ids too: a stale id would make redraw think a frame is still pending.
      cancelAnimationFrame(t.frame);
      clearTimeout(t.fine);
      t.frame = t.fine = 0;
    };
  }, []);

  const selected = doc.shapes.filter((s) => selection.includes(s.id));
  const selectionBounds = shapesBounds(selected);
  // One shape: box in its own frame. Mixed selection: upright box around all.
  const single = selected.length === 1 ? selected[0] : null;
  const boxFrame = single?.rotation ?? 0;
  const box = single ? { x: single.x, y: single.y, width: single.width, height: single.height } : selectionBounds;
  const boxCentre = box ? rectCenter(box) : { x: 0, y: 0 };
  const px = (value: number) => value / scale;

  return (
    <div className="canvas-area" data-rulers={rulers || undefined}>
      {rulers && (
        <>
          <div className="ruler-corner" />
          <Ruler axis="x" length={size.width} scale={scale} offset={panX} selection={selectionBounds} />
          <Ruler axis="y" length={size.height} scale={scale} offset={panY} selection={selectionBounds} />
        </>
      )}

      <div
        className="canvas-viewport"
        ref={viewportRef}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={onDrop}
      >
        <svg
          className="canvas-svg"
          width={size.width}
          height={size.height}
          onPointerDown={(event) => {
            // Hit targets stop propagation, so reaching here means bare canvas:
            // start a selection rectangle. Shift keeps what is already selected.
            if (event.button !== 0) return;
            const store = useEditor.getState();
            const base = event.shiftKey ? store.selection : [];
            if (!event.shiftKey) store.clearSelection();
            store.beginInteraction({ mode: "marquee", startPointer: toLogical(event), base });
          }}
        >
          <g transform={`translate(${panX} ${panY}) scale(${scale})`}>
            <rect className="artboard" width={CANVAS} height={CANVAS} fill={doc.appearance.previewBackground} />
            {pixelGrid && <PixelGrid scale={scale} />}
            <g fill={doc.appearance.fill} pointerEvents="none">
              <g ref={gooRef} fillRule="evenodd" />
              <g ref={sourcesRef}>
                {byColour(doc.shapes.filter((s) => !s.hidden), doc.appearance.fill).map((s) => (
                    <g key={s.id} data-id={s.id} fill={s.fill}>
                      <ShapeNode shape={s} />
                    </g>
                  ))}
              </g>
            </g>

            <g>
              {byColour(doc.shapes.filter((s) => !s.hidden && !s.locked), doc.appearance.fill).map((s) => (
                  <ShapeNode
                    key={s.id}
                    shape={s}
                    fill="transparent"
                    pointerEvents="all"
                    style={{ cursor: altDown ? "copy" : "move" }}
                    onPointerDown={(event) => beginShapeDrag(event, s)}
                  />
                ))}
            </g>

            {/* Rides the painted geometry: an outline detached from its block reads as a bug. */}
            <g className="overlay" pointerEvents="none" ref={overlayRef}>
              {selected.map((s) => (
                <ShapeNode key={s.id} shape={s} fill="none" stroke={ACCENT} strokeWidth={px(1)} opacity={0.6} />
              ))}

              {box && (
                <g transform={boxFrame ? `rotate(${boxFrame} ${boxCentre.x} ${boxCentre.y})` : undefined}>
                  <rect
                    x={box.x}
                    y={box.y}
                    width={box.width}
                    height={box.height}
                    fill="none"
                    stroke={ACCENT}
                    strokeWidth={px(1.5)}
                  />
                  <line
                    x1={box.x + box.width / 2}
                    y1={box.y}
                    x2={box.x + box.width / 2}
                    y2={box.y - px(20)}
                    stroke={ACCENT}
                    strokeWidth={px(1.5)}
                  />
                  <circle
                    cx={box.x + box.width / 2}
                    cy={box.y - px(20)}
                    r={px(5.5)}
                    fill="#ffffff"
                    stroke={ACCENT}
                    strokeWidth={px(1.5)}
                    pointerEvents="all"
                    style={{ cursor: "grab" }}
                    onPointerDown={beginRotate}
                  />
                  {HANDLES.map((handle) => {
                    const pos = handlePosition(box, handle);
                    const s = px(9);
                    return (
                      <rect
                        key={handle}
                        x={pos.x - s / 2}
                        y={pos.y - s / 2}
                        width={s}
                        height={s}
                        fill="#ffffff"
                        stroke={ACCENT}
                        strokeWidth={px(1.5)}
                        pointerEvents="all"
                        style={{ cursor: handleCursor(handle) }}
                        onPointerDown={(event) => beginResize(event, handle)}
                      />
                    );
                  })}
                </g>
              )}

              {single && supportsRadius(single.type) && (
                <circle
                  cx={single.x + Math.max(single.radius, px(14))}
                  cy={single.y + Math.max(single.radius, px(14))}
                  r={px(5)}
                  fill="#ffffff"
                  stroke={ACCENT}
                  strokeWidth={px(1.5)}
                  pointerEvents="all"
                  transform={boxFrame ? `rotate(${boxFrame} ${boxCentre.x} ${boxCentre.y})` : undefined}
                  style={{ cursor: "ew-resize" }}
                  onPointerDown={(event) => beginRadius(event, single)}
                />
              )}
            </g>

            {marquee && (
              <rect
                className="marquee"
                x={marquee.x}
                y={marquee.y}
                width={marquee.width}
                height={marquee.height}
                strokeWidth={px(1)}
                pointerEvents="none"
              />
            )}

            <g className="guides" stroke={GUIDE} strokeWidth={px(1)} pointerEvents="none">
              {guides.map((g, i) => {
                const [x1, y1, x2, y2] = g.axis === "x" ? [g.at, g.from, g.at, g.to] : [g.from, g.at, g.to, g.at];
                const m = px(3);
                return (
                  <g key={i}>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} />
                    {[[x1, y1], [x2, y2]].map(([x, y], j) => (
                      <path key={j} d={`M${x - m} ${y - m}L${x + m} ${y + m}M${x + m} ${y - m}L${x - m} ${y + m}`} />
                    ))}
                  </g>
                );
              })}
            </g>
          </g>
        </svg>

        {doc.shapes.length === 0 && <p className="canvas-hint">Drag a shape or preset here, or press Generate icon.</p>}
      </div>
    </div>
  );
}

/**
 * Shapes in the goo's paint order: colour by colour, each colour at the height of
 * its topmost shape. The live vectors shown while dragging must stack the same way,
 * or a colour that sits on top at rest would vanish under the others mid-drag.
 */
function byColour(shapes: Shape[], fill: string) {
  const fills = shapes.map((s) => s.fill ?? fill);
  return shapes
    .map((s, i) => ({ s, rank: fills.lastIndexOf(fills[i]), i }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map((x) => x.s);
}

const GRID_STEPS = [1, 2, 5, 10, 20, 50, 100];

/** Unit grid over the artboard, as fine as the zoom allows; every tenth line is stronger. */
function PixelGrid({ scale }: { scale: number }) {
  const step = GRID_STEPS.find((s) => s * scale >= 8) ?? 100;
  const major = step * 10;
  const w = 1 / scale;
  return (
    <g pointerEvents="none">
      <defs>
        <pattern id="grid-minor" width={step} height={step} patternUnits="userSpaceOnUse">
          <path d={`M${step} 0V${step}H0`} fill="none" className="grid-minor" strokeWidth={w} />
        </pattern>
        <pattern id="grid-major" width={major} height={major} patternUnits="userSpaceOnUse">
          <rect width={major} height={major} fill="url(#grid-minor)" />
          <path d={`M${major} 0V${major}H0`} fill="none" className="grid-major" strokeWidth={w} />
        </pattern>
      </defs>
      <rect width={CANVAS} height={CANVAS} fill="url(#grid-major)" />
    </g>
  );
}
