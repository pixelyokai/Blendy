import type { DragEvent, ReactNode } from "react";
import { PRESETS } from "../presets/presets";
import { useEditor } from "../state/editorStore";
import { GooPreview } from "./GooPreview";
import { Toolbar } from "./Toolbar";
import { ColorInput, GooSlider, NumberField } from "./Fields";
import { DRAG_TYPE } from "./Canvas";
import { shapesBounds } from "../geometry/bounds";
import { mapShapeToBounds } from "../geometry/transforms";
import { needsEvenOdd, shapePath } from "../geometry/shapePath";
import {
  SHAPE_BLUEPRINTS,
  blueprintFor,
  clampInnerRatio,
  clampPoints,
  clampRadius,
  clampSides,
  MIN_SIZE,
  normalizeRotation,
  supportsInnerRatio,
  supportsPoints,
  supportsRadius,
  supportsSides,
  type Shape,
  type ShapeType,
} from "../model/shape";
import { round } from "../utils/clamp";

const GLYPHS = (Object.keys(SHAPE_BLUEPRINTS) as ShapeType[]).map((type) => {
  const shape = blueprintFor(type, type, 0, 0);
  const scale = Math.min(20 / shape.width, 20 / shape.height);
  return {
    type,
    d: shapePath({
      ...shape,
      x: (24 - shape.width * scale) / 2,
      y: (24 - shape.height * scale) / 2,
      width: shape.width * scale,
      height: shape.height * scale,
      radius: shape.radius * scale,
    }),
  };
});

const dragPayload = (kind: "shape" | "preset", id: string) => (event: DragEvent) => {
  event.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ kind, id }));
  event.dataTransfer.effectAllowed = "copy";
};

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="section">
    <h2 className="section-title">{title}</h2>
    {children}
  </section>
);

export function Sidebar() {
  const insertShape = useEditor((s) => s.insertShape);
  const insertPreset = useEditor((s) => s.insertPreset);
  const count = useEditor((s) => s.selection.length);

  return (
    <aside className="sidebar-wrap" aria-label="Tools and properties">
      <div className="sidebar">
        <Toolbar />
        <div className="sidebar-body">
          <DocumentSection />
          <hr className="divider" />
          <Section title="Shapes">
            <div className="tiles">
              {GLYPHS.map(({ type, d }) => (
                <button
                  key={type}
                  className="tile"
                  data-tip={SHAPE_BLUEPRINTS[type].label}
                  aria-label={`Add ${SHAPE_BLUEPRINTS[type].label}`}
                  draggable
                  onDragStart={dragPayload("shape", type)}
                  onClick={() => insertShape(type)}
                >
                  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                    <path d={d} fillRule={needsEvenOdd(type) ? "evenodd" : undefined} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  </svg>
                </button>
              ))}
            </div>
          </Section>
          <hr className="divider" />
          <Section title="Presets">
            <div className="tiles">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className="tile"
                  data-tip={preset.name}
                  aria-label={`Add ${preset.name}`}
                  draggable
                  onDragStart={dragPayload("preset", preset.id)}
                  onClick={() => insertPreset(preset.id)}
                >
                  <GooPreview preset={preset} />
                </button>
              ))}
            </div>
          </Section>
          {count > 0 && (
            <>
              <hr className="divider" />
              <SelectionSection />
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

function DocumentSection() {
  const fill = useEditor((s) => s.document.appearance.fill);
  const background = useEditor((s) => s.document.appearance.previewBackground);
  const amount = useEditor((s) => s.document.goo.amount);
  const { setFill, setPreviewBackground, setGoo, beginTransaction, endTransaction } = useEditor.getState();

  return (
    <Section title="Document">
      <div className="doc-colors">
        <div className="stack">
          <span className="stack-label">Shape fill</span>
          <ColorInput label="Shape fill" value={fill} onInput={(v) => setFill(v, false)} />
        </div>
        <div className="stack">
          <span className="stack-label">Background fill</span>
          <ColorInput label="Background fill" value={background} onInput={setPreviewBackground} />
        </div>
      </div>
      <div className="goo">
        <span className="stack-label">Goo amount</span>
        <GooSlider value={amount} onStart={beginTransaction} onEnd={endTransaction} onInput={(v) => setGoo(v, false)} />
      </div>
    </Section>
  );
}

/** Fill for the selection: a shared colour, or the document fill until one is set. */
function ShapeColor({ shapes }: { shapes: Shape[] }) {
  const global = useEditor((s) => s.document.appearance.fill);
  const setSelectionFill = useEditor((s) => s.setSelectionFill);
  const fills = new Set(shapes.map((s) => s.fill ?? global));
  return (
    <div className="field">
      <span className="field-label">Color</span>
      <ColorInput label="Shape colour" value={fills.size === 1 ? [...fills][0] : global} mixed={fills.size > 1} onInput={(v) => setSelectionFill(v, false)} />
    </div>
  );
}

function SelectionSection() {
  const shapes = useEditor((s) => s.document.shapes);
  const selection = useEditor((s) => s.selection);
  const { updateShape, commitShapes } = useEditor.getState();
  const selected = shapes.filter((s) => selection.includes(s.id));

  if (selected.length === 1) {
    const [shape] = selected;
    const set = (patch: Partial<Shape>) => updateShape(shape.id, patch);
    return (
      <Section title={SHAPE_BLUEPRINTS[shape.type].label}>
        <div className="pairs">
          <div className="pair">
            <NumberField compact label="X" value={shape.x} onCommit={(x) => set({ x })} />
            <NumberField compact label="Y" value={shape.y} onCommit={(y) => set({ y })} />
          </div>
          <div className="pair">
            <NumberField compact label="W" value={shape.width} min={MIN_SIZE} onCommit={(width) => set({ width })} />
            <NumberField compact label="H" value={shape.height} min={MIN_SIZE} onCommit={(height) => set({ height })} />
          </div>
        </div>
        <div className="props">
          <ShapeColor shapes={selected} />
          <NumberField label="Rotate" value={shape.rotation} step={5} onCommit={(v) => set({ rotation: normalizeRotation(v) })} />
          {supportsRadius(shape.type) && (
            <NumberField
              label={shape.type === "cylinder" || shape.type === "cone" ? "Depth" : "Radius"}
              value={shape.radius}
              min={0}
              max={Math.min(shape.width, shape.height) / 2}
              onCommit={(v) => set({ radius: clampRadius(v, shape.width, shape.height) })}
            />
          )}
          {supportsSides(shape.type) && <NumberField label="Sides" value={shape.sides ?? 6} min={3} max={12} onCommit={(v) => set({ sides: clampSides(v) })} />}
          {supportsPoints(shape.type) && <NumberField label="Points" value={shape.points ?? 5} min={3} max={12} onCommit={(v) => set({ points: clampPoints(v) })} />}
          {supportsInnerRatio(shape.type) && (
            <NumberField
              label={shape.type === "torus" ? "Hole" : "Waist"}
              value={Math.round((shape.innerRatio ?? 0.45) * 100)}
              min={10}
              max={90}
              onCommit={(v) => set({ innerRatio: clampInnerRatio(v / 100) })}
            />
          )}
        </div>
      </Section>
    );
  }

  const bounds = shapesBounds(selected);
  if (!bounds) return null;
  const apply = (patch: Partial<typeof bounds>) => {
    const next = { ...bounds, ...patch };
    next.width = Math.max(1, next.width);
    next.height = Math.max(1, next.height);
    commitShapes(shapes.map((s) => (selection.includes(s.id) ? mapShapeToBounds(s, bounds, next) : s)));
  };
  const radii = selected.map((s) => round(s.radius));
  const shared = radii.every((r) => r === radii[0]) ? radii[0] : null;

  return (
    <Section title={`${selected.length} shapes`}>
      <div className="pairs">
        <div className="pair">
          <NumberField compact label="X" value={bounds.x} onCommit={(x) => apply({ x })} />
          <NumberField compact label="Y" value={bounds.y} onCommit={(y) => apply({ y })} />
        </div>
        <div className="pair">
          <NumberField compact label="W" value={bounds.width} min={1} onCommit={(width) => apply({ width })} />
          <NumberField compact label="H" value={bounds.height} min={1} onCommit={(height) => apply({ height })} />
        </div>
      </div>
      <div className="props">
        <ShapeColor shapes={selected} />
        {shared !== null && (
          <NumberField
            label="Radius"
            value={shared}
            min={0}
            onCommit={(v) => commitShapes(shapes.map((s) => (selection.includes(s.id) ? { ...s, radius: clampRadius(v, s.width, s.height) } : s)))}
          />
        )}
      </div>
    </Section>
  );
}
