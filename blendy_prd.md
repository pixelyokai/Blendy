# Blendy — Product Requirements Document

**Product name:** Blendy  
**Document version:** 1.0  
**Status:** Build-ready MVP specification  
**Product type:** Browser-based generative SVG shape editor  
**Primary users:** Product designers, brand designers, visual designers, front-end developers  
**Primary output:** Gooey abstract shapes exported as SVG or PNG

### SEO metadata

**Meta title:** Blendy — Create Gooey SVG Shapes Online

**Meta description:** Create fluid, gooey shapes by blending simple geometry together. Customize size, radius, and form, then export your creation as SVG or PNG.

---

## 1. Executive summary

Blendy recreates the core interaction model of the discontinued Flectofy tool: users begin from a small set of preset compositions made from rounded geometric primitives, drag and resize those primitives on a canvas, and see them merge visually into a single liquid or “gooey” form.

The editor should feel much lighter than Illustrator, Figma, or a general-purpose vector editor. A user should be able to open the site, choose a form, adjust it for 20–60 seconds, and export something usable.

The central product idea is:

> **Compose with simple rounded rectangles; render as one organic shape.**

The editor does not need freeform Bézier drawing in the MVP. Its value comes from the tension between rigid orthogonal geometry and soft liquid joins.

The original Flectofy interface can still be indexed with the controls **Undo, Width, Height, Reset, SVG, PNG, Save** and the presets **Blank, The Flecto, The fat Flecto, Twins, System #1, System #2, Caption, The éLe, Mirror**. Contemporary descriptions characterize it as an interactive tool for draggable SVG “goo” objects. This PRD preserves that core model while defining missing implementation details as a modern reconstruction.

---

## 2. Product principles

### 2.1 Fast before powerful

The product should not become a vector editor. Every new feature must be evaluated against the question: does this help users make a useful gooey shape faster?

### 2.2 Direct manipulation first

Users should manipulate geometry on the canvas instead of editing coordinates manually. Numeric fields exist for precision, but dragging and handles are the default interaction.

### 2.3 The effect is always live

The goo effect must update during drag and resize. The user should never need to press an “Apply” button.

### 2.4 Presets are starting points, not templates

A preset creates an editable arrangement of primitives. After insertion, every primitive behaves exactly like a shape created manually.

### 2.5 SVG is the source of truth

The working document is represented as vector primitives and SVG filter parameters. PNG is derived from the SVG scene.

### 2.6 Minimal visual chrome

The UI should remain visually quiet. The artwork is the dominant object on screen.

---

## 3. Problem

Designers frequently need abstract brand forms, background elements, stickers, section dividers, visual accents, avatars, masks, or decorative shapes.

Typical alternatives have drawbacks:

- generic blob generators tend to create radial Bézier blobs with a similar visual character;
- Illustrator/Figma can create these forms but require significantly more manual work;
- CSS/SVG goo examples are developer-oriented and not usable as visual design tools;
- boolean-union workflows destroy the immediacy of moving individual source primitives after the union.

The opportunity is a narrow-purpose editor that makes a distinctive class of shapes extremely quickly.

---

## 4. Product goal

Enable a first-time user to create and export a distinctive gooey shape in **under one minute**, without understanding SVG filters or vector boolean operations.

### Success definition

The MVP succeeds when a user can:

1. open the editor;
2. select a preset or blank document;
3. drag, resize, duplicate, add, or delete primitive shapes;
4. adjust width, height, corner radius, and goo intensity;
5. undo mistakes;
6. export a visually matching SVG or PNG.

---

## 5. Non-goals for MVP

The following are intentionally out of scope:

- full pen/Bézier tooling;
- arbitrary vector import;
- text editing;
- image import;
- layers panel with deep nesting;
- gradients;
- strokes;
- multi-page documents;
- cloud accounts;
- collaboration;
- animation timeline;
- 3D;
- AI generation;
- template marketplace;
- advanced typography;
- mobile editing.

These can be reconsidered after the editor proves useful.

---

## 6. Target users

### Primary: visual/product designers

Need fast abstract shapes for UI, brand, social, deck, web, or experimental work.

### Secondary: front-end developers

Want a visual way to produce reusable SVG shapes without manually tuning filter parameters.

### Secondary: students and creative coders

Want to explore SVG goo effects through direct manipulation.

---

## 7. Core user jobs

### Job A — Make a decorative shape

“I need an interesting vector object for a composition, and I want it in a minute rather than drawing it manually.”

### Job B — Explore shape variations

“I want to move simple pieces around and discover forms I would not draw deliberately.”

### Job C — Match an existing layout

“I want exact control over size and corner radius while retaining the organic connections.”

### Job D — Export for design software

“I want a result I can bring into Figma, Illustrator, Framer, or a website.”

---

## 8. Information architecture

The MVP has two primary states.

### State 1 — Start screen

Contains:

- product wordmark;
- short one-line explanation;
- preset cards;
- “Blank” option.

Selecting any option enters the editor.

### State 2 — Editor

Desktop layout:

| Region | Purpose |
|---|---|
| Left rail | Presets and add-shape controls |
| Top bar | Undo/redo, reset, zoom, export |
| Canvas | Direct manipulation |
| Right inspector | Geometry and goo properties |
| Bottom-left utility | Zoom percentage / fit-to-view |
| Bottom-right optional | Help / shortcuts |

The editor should fit comfortably at 1280×720 and larger.

---

## 9. Start screen

### Required preset choices

1. Blank
2. The Flecto
3. The fat Flecto
4. Twins
5. System #1
6. System #2
7. Caption
8. The éLe
9. Mirror

“Blank” is not counted as one of the eight original preset forms.

### Preset card behavior

Each card contains a live miniature SVG rendering rather than a static image.

On hover:

- artwork slightly scales or shifts;
- label remains readable;
- pointer indicates clickability.

On click:

- instantiate a new document from preset data;
- fit artwork to canvas;
- place first editable selection state with nothing selected.

---

## 10. Editor interaction model

### 10.1 Selection

Click a visible primitive to select it.

Selected shape displays:

- bounding box;
- eight resize handles;
- optional corner-radius handle;
- no rotation handle in MVP.

Shift-click adds/removes shapes from a multi-selection.

Click empty canvas to clear selection.

Escape clears selection.

### 10.2 Dragging

Pointer-down on a selected primitive begins drag.

During drag:

- update `x` and `y` every animation frame;
- keep the goo filter live;
- do not commit an undo entry on every frame;
- commit one history entry on pointer-up.

Default behavior allows primitives to move outside the artboard temporarily, but exported bounds depend on export settings.

### 10.3 Resize

Eight handles:

- N, S change height;
- E, W change width;
- corner handles change both.

Modifier behavior:

- **Shift:** preserve aspect ratio;
- **Alt/Option:** resize from center;
- **Shift + Alt/Option:** preserve ratio from center.

Minimum primitive size: `12 × 12` canvas units.

### 10.4 Corner radius

Each rounded rectangle has a radius property `r`.

Inspector exposes a radius input/slider.

Recommended on-canvas behavior:

- a small circular radius handle appears near the top-left interior corner;
- dragging horizontally changes radius.

Constraint:

`0 <= r <= min(width, height) / 2`

Default newly inserted shape radius:

`min(width, height) × 0.25`

### 10.5 Add shape

Left rail contains:

- rounded rectangle;
- circle.

For MVP, a circle is represented internally as a rounded rectangle where:

`width == height` and `radius == width / 2`

Clicking a shape tool inserts the shape at canvas center.

A new rounded rectangle defaults to:

- width 160;
- height 96;
- radius 32.

### 10.6 Duplicate

`Cmd/Ctrl + D`

Duplicate is offset by `16px, 16px` from the original.

The duplicate becomes selected.

### 10.7 Delete

Backspace/Delete removes selected primitives.

The editor must never allow deletion of the document itself; an empty canvas is valid.

### 10.8 Nudge

Arrow key: 1 unit.  
Shift + Arrow: 10 units.

### 10.9 Undo / redo

Undo:

`Cmd/Ctrl + Z`

Redo:

`Cmd/Ctrl + Shift + Z`

Track at minimum:

- insert;
- delete;
- drag;
- resize;
- radius;
- fill color;
- goo settings;
- preset load;
- reset;
- duplicate;
- multi-selection transform.

Maximum history length: 100 actions.

### 10.10 Reset

Reset restores the document to the state produced when its currently loaded preset was first instantiated.

For a Blank document, Reset returns to an empty canvas.

Reset is undoable.

---

## 11. Inspector

The inspector changes according to selection state.

### 11.1 No selection

Show document-level settings:

- Canvas width
- Canvas height
- Fill
- Background preview
- Goo amount
- Edge softness
- Export padding

### 11.2 Single shape selected

Show:

- X
- Y
- Width
- Height
- Radius
- Lock aspect ratio
- Duplicate
- Delete

### 11.3 Multiple shapes selected

Show:

- combined X
- combined Y
- combined width
- combined height
- align controls
- distribute controls
- duplicate
- delete

Per-shape radius is hidden during multi-selection unless all selected values match.

---

## 12. Canvas

### Default logical canvas

`1000 × 1000`

The browser viewport scales the logical canvas visually.

All preset values are stored in logical canvas units, not CSS pixels.

### Default background

White preview.

Background is not part of the exported SVG unless “Include background” is explicitly enabled in export settings.

### Zoom

Required:

- Fit
- 25%
- 50%
- 100%
- 200%
- wheel/trackpad zoom

Recommended keyboard shortcuts:

- `0` → Fit
- `1` → 100%
- `+` / `-` → zoom in/out

Zoom must not alter document geometry.

### Pan

Space + drag pans canvas.

Trackpad two-finger scroll pans.

---

## 13. Rendering model

### 13.1 Scene representation

The canonical document contains independent primitives.

Example:

```ts
type Shape = {
  id: string
  type: "roundedRect"
  x: number
  y: number
  width: number
  height: number
  radius: number
  rotation: 0
}
```

All shapes in the MVP share one document fill color.

The shapes are rendered inside a filtered SVG group.

```svg
<svg viewBox="0 0 1000 1000">
  <defs>
    <filter id="goo">
      ...
    </filter>
  </defs>

  <g filter="url(#goo)">
    <rect ... />
    <rect ... />
    <rect ... />
  </g>
</svg>
```

### 13.2 Goo filter

Recommended default:

```svg
<filter
  id="goo"
  x="-30%"
  y="-30%"
  width="160%"
  height="160%"
  color-interpolation-filters="sRGB"
>
  <feGaussianBlur
    in="SourceGraphic"
    stdDeviation="10"
    result="blur"
  />

  <feColorMatrix
    in="blur"
    mode="matrix"
    values="
      1 0 0 0 0
      0 1 0 0 0
      0 0 1 0 0
      0 0 0 18 -7
    "
    result="goo"
  />

  <feComposite
    in="SourceGraphic"
    in2="goo"
    operator="atop"
    result="composite"
  />
</filter>
```

The essential visual technique is:

1. blur alpha;
2. increase alpha contrast;
3. threshold the blurred overlap into a hard connected silhouette.

### 13.3 User-facing goo controls

Do not expose raw SVG filter matrix fields in the normal UI.

Expose two semantic controls.

#### Goo amount

Range: `0–100`  
Default: `50`

Internally controls blur radius and threshold compensation.

Suggested mapping:

```ts
blur = lerp(0, 24, gooAmount / 100)
alphaGain = lerp(1, 24, gooAmount / 100)
alphaBias = -0.42 * alphaGain
```

The exact mapping should be tuned visually.

#### Edge softness

Range: `0–100`  
Default: `15`

Affects threshold aggressiveness without materially changing connection distance.

Advanced raw controls can be added later.

### 13.4 Why SVG instead of canvas for editing

SVG provides:

- crisp rendering;
- direct mapping to export;
- native geometric elements;
- easier hit-testing;
- inspectable output;
- good support for filters;
- fewer conversion steps.

Canvas should only be used where needed for PNG rendering or outline extraction.

---

## 14. Document data model

```ts
type GooDocument = {
  version: 1

  id: string
  name: string

  canvas: {
    width: number
    height: number
  }

  appearance: {
    fill: string
    previewBackground: string
  }

  goo: {
    amount: number
    edgeSoftness: number
  }

  export: {
    padding: number
    includeBackground: boolean
    scale: 1 | 2 | 3 | 4
  }

  shapes: Shape[]

  sourcePresetId: string | null
}
```

### Shape model

```ts
type RoundedRectShape = {
  id: string
  type: "roundedRect"

  x: number
  y: number

  width: number
  height: number

  radius: number

  locked: boolean
  hidden: boolean
}
```

Rotation is deliberately omitted from MVP.

---

## 15. Preset schema

```ts
type Preset = {
  id: string
  name: string
  canvas: {
    width: 1000
    height: 1000
  }
  goo: {
    amount: number
    edgeSoftness: number
  }
  shapes: Array<{
    x: number
    y: number
    width: number
    height: number
    radius: number
  }>
}
```

Preset geometry below is a **reconstruction**, not a claim that these are the original Flectofy coordinates.

---

## 16. Reconstructed preset definitions

All values assume a `1000 × 1000` canvas.

### 16.1 Blank

```json
{
  "id": "blank",
  "name": "Blank",
  "shapes": []
}
```

### 16.2 The Flecto

Visual intent: three compact horizontal pieces arranged as a stepped vertical cluster.

```json
{
  "id": "the-flecto",
  "name": "The Flecto",
  "shapes": [
    { "x": 350, "y": 300, "width": 250, "height": 110, "radius": 38 },
    { "x": 300, "y": 425, "width": 300, "height": 110, "radius": 38 },
    { "x": 350, "y": 550, "width": 250, "height": 110, "radius": 38 }
  ]
}
```

### 16.3 The fat Flecto

Visual intent: chunky offset bars that produce a wide asymmetric silhouette.

```json
{
  "id": "fat-flecto",
  "name": "The fat Flecto",
  "shapes": [
    { "x": 315, "y": 300, "width": 360, "height": 210, "radius": 56 },
    { "x": 245, "y": 485, "width": 510, "height": 155, "radius": 52 }
  ]
}
```

### 16.4 Twins

Visual intent: two opposing block forms with a narrow goo connection.

```json
{
  "id": "twins",
  "name": "Twins",
  "shapes": [
    { "x": 300, "y": 295, "width": 210, "height": 380, "radius": 58 },
    { "x": 490, "y": 325, "width": 210, "height": 350, "radius": 58 }
  ]
}
```

### 16.5 System #1

Visual intent: two broad horizontal masses with offset protrusions.

```json
{
  "id": "system-1",
  "name": "System #1",
  "shapes": [
    { "x": 260, "y": 320, "width": 480, "height": 170, "radius": 52 },
    { "x": 330, "y": 475, "width": 420, "height": 170, "radius": 52 }
  ]
}
```

### 16.6 System #2

Visual intent: long low bar with a small raised segment.

```json
{
  "id": "system-2",
  "name": "System #2",
  "shapes": [
    { "x": 245, "y": 470, "width": 520, "height": 150, "radius": 48 },
    { "x": 245, "y": 380, "width": 165, "height": 180, "radius": 48 }
  ]
}
```

### 16.7 Caption

Visual intent: compact L-shaped form.

```json
{
  "id": "caption",
  "name": "Caption",
  "shapes": [
    { "x": 330, "y": 325, "width": 160, "height": 360, "radius": 50 },
    { "x": 330, "y": 525, "width": 355, "height": 160, "radius": 50 }
  ]
}
```

### 16.8 The éLe

Visual intent: interlocking perpendicular rectangles.

```json
{
  "id": "ele",
  "name": "The éLe",
  "shapes": [
    { "x": 300, "y": 430, "width": 410, "height": 150, "radius": 48 },
    { "x": 430, "y": 300, "width": 150, "height": 410, "radius": 48 }
  ]
}
```

### 16.9 Mirror

Visual intent: symmetric mirrored masses.

```json
{
  "id": "mirror",
  "name": "Mirror",
  "shapes": [
    { "x": 285, "y": 350, "width": 245, "height": 300, "radius": 60 },
    { "x": 470, "y": 350, "width": 245, "height": 300, "radius": 60 }
  ]
}
```

### Preset tuning requirement

Before public release, compare thumbnail silhouettes against surviving Flectofy references and tune geometry manually.

Do not block MVP engineering on pixel-perfect historical reproduction.

---

## 17. Fill and appearance

### MVP

One fill color applies to the complete goo group.

Default:

`#72F6A6` or another bright temporary brand color.

Users may select:

- any solid hex/RGB color;
- transparent is not valid as the primary shape fill.

### Later

Potential additions:

- gradient fill;
- per-shape fill;
- noise;
- texture;
- blend modes.

These should not enter MVP because per-shape colors complicate the goo compositing model.

---

## 18. Export

Export is a critical feature and must be treated as a first-class workflow.

### 18.1 Export menu

Top-right button: **Export**

Opens a compact popover.

Fields:

- Format: SVG / PNG
- Bounds: Canvas / Artwork
- Padding
- PNG scale: 1× / 2× / 3× / 4×
- Include background
- Download

Default:

- SVG
- Artwork bounds
- 24 units padding
- transparent background

---

## 19. SVG export — MVP mode

### Requirement

Export a self-contained SVG that visually matches the editor.

Include:

- viewBox;
- `<defs>`;
- goo filter;
- primitive geometry;
- group fill;
- filter-region padding.

Do not include:

- editor handles;
- selection outlines;
- metadata unnecessary for rendering.

Example structure:

```svg
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 540 420"
>
  <defs>
    <filter id="goo" ...>
      ...
    </filter>
  </defs>

  <g fill="#72F6A6" filter="url(#goo)">
    <rect ... />
    <rect ... />
  </g>
</svg>
```

### Limitation

Some downstream design tools handle SVG filters inconsistently.

The UI should state:

> “Live SVG keeps the goo filter. For maximum compatibility, use PNG until Outline SVG is available.”

---

## 20. Outline SVG — recommended V1.1

This feature converts the filtered appearance into a real vector path.

It is not required for the first MVP launch, but should be the highest-priority follow-up because it significantly improves Figma/Illustrator compatibility.

### Suggested pipeline

1. serialize current SVG;
2. render it to an offscreen bitmap at 4×–8× resolution;
3. read alpha pixels;
4. threshold alpha;
5. run marching squares to extract contours;
6. simplify contour with Ramer–Douglas–Peucker;
7. fit cubic Bézier segments;
8. return one or more SVG `<path>` elements;
9. preserve document fill.

### Acceptance target

At normal viewing size, the outlined result should visually deviate by no more than approximately 1–2 screen pixels from the live filtered result.

---

## 21. PNG export

Pipeline:

1. serialize SVG;
2. render into offscreen canvas at requested scale;
3. optionally paint background;
4. convert canvas to PNG blob;
5. download.

### PNG bounds

If “Artwork” is selected:

- compute primitive bounds;
- expand by goo blur radius;
- add requested padding;
- crop to those bounds.

If “Canvas” is selected:

- use entire artboard.

---

## 22. Bounding calculations

The filter expands beyond source geometry.

Approximate filtered bounds as:

```ts
filterPadding =
  exportPadding +
  blurStdDeviation * 3
```

For a shape:

```ts
left = x - filterPadding
top = y - filterPadding
right = x + width + filterPadding
bottom = y + height + filterPadding
```

Union bounds across all visible shapes.

---

## 23. History architecture

Use command snapshots rather than frame-by-frame recording.

Recommended approach:

```ts
type HistoryState = {
  past: GooDocument[]
  present: GooDocument
  future: GooDocument[]
}
```

For MVP document sizes, full immutable snapshots are acceptable.

Commit state only at semantic boundaries:

- pointer-up;
- numeric-input commit;
- insert;
- delete;
- preset load;
- reset;
- duplicate.

Do not commit on every pointer move.

---

## 24. Suggested technical stack

### Front end

- React
- TypeScript
- Vite or Next.js
- SVG DOM for canvas
- Zustand for editor state
- Immer for immutable updates
- `@use-gesture/react` or native Pointer Events
- browser Canvas API for PNG export

A framework is not mandatory. The core editor should remain framework-agnostic enough that SVG document functions can be unit-tested independently.

### Do not use Fabric.js or Konva for MVP unless needed

The editor only manipulates simple SVG primitives. A heavyweight canvas abstraction creates extra work for SVG-filter rendering and export.

Native SVG + Pointer Events is the simpler architecture.

### Deployment

**Hosting target:** Vercel

Recommended deployment setup:

- deploy the production web app on Vercel;
- use automatic preview deployments for branches and pull requests;
- keep the editor primarily client-side so core shape editing and export do not depend on a backend;
- use Vercel environment variables only if analytics, error reporting, storage, or future API features require them;
- configure the production domain and canonical metadata through the app's document head / framework metadata configuration;
- ensure SVG and PNG exports happen locally in the browser wherever possible.

For the MVP, Blendy should be capable of running as a largely static/client-rendered application, which makes it a strong fit for Vercel deployment.

---

## 25. Suggested module architecture

```text
src/
  editor/
    Editor.tsx
    Canvas.tsx
    SelectionOverlay.tsx
    TransformHandles.tsx
    PresetRail.tsx
    Inspector.tsx
    Topbar.tsx

  model/
    document.ts
    shape.ts
    preset.ts

  state/
    editorStore.ts
    history.ts

  geometry/
    bounds.ts
    resize.ts
    hitTest.ts
    transforms.ts

  goo/
    filter.ts
    mapping.ts

  presets/
    presets.ts

  export/
    serializeSvg.ts
    exportPng.ts
    outlineSvg.ts

  utils/
    ids.ts
    clamp.ts
    download.ts
```

---

## 26. Key editor state

```ts
type EditorState = {
  document: GooDocument

  selection: string[]

  viewport: {
    zoom: number
    panX: number
    panY: number
  }

  interaction:
    | { mode: "idle" }
    | { mode: "dragging"; startPointer: Point; startShapes: Shape[] }
    | { mode: "resizing"; handle: ResizeHandle; ... }
    | { mode: "radius"; ... }
    | { mode: "panning"; ... }

  history: HistoryState
}
```

Interaction state should remain separate from document state so temporary drag movement does not pollute history.

---

## 27. Hit testing

Preferred method:

- SVG elements receive pointer events;
- selection overlay receives transform interactions;
- the goo-rendered group is visual;
- a parallel invisible hit target can be used if filtering makes pointer targeting confusing.

For each visible primitive, render:

```svg
<rect
  class="hit-target"
  fill="transparent"
  pointer-events="all"
/>
```

The hit target corresponds to the original primitive geometry, not the merged goo silhouette.

This preserves the mental model that users are manipulating source blocks.

---

## 28. Multi-selection

MVP may ship without multi-selection if schedule is tight.

If implemented:

- Shift-click adds/removes;
- drag moves all selected shapes;
- group resize scales positions and dimensions around the combined bounding box;
- radius values scale proportionally with geometry.

Do not permanently group shapes in the document model.

---

## 29. Snapping

### MVP

No snapping required.

### V1.1

Optional snap modes:

- canvas center;
- shape edges;
- shape centers;
- 8-unit grid.

Hold `Cmd/Ctrl` to temporarily disable snapping.

---

## 30. Responsive behavior

### Desktop/tablet landscape

Full editor.

### Below 900px width

Show a deliberate unsupported-editor screen:

> “This editor works best on a larger screen.”

Allow users to browse preset thumbnails, but do not attempt a compromised mobile editor in MVP.

This mirrors the reality that precision canvas editing is a desktop task.

---

## 31. Accessibility

The editor is visual, but standard controls must remain accessible.

Requirements:

- all buttons have accessible names;
- keyboard shortcuts are documented;
- inspector fields can be changed without pointer input;
- visible focus states;
- sufficient UI contrast;
- preset thumbnails include names;
- export controls are keyboard navigable.

Canvas-based geometry manipulation does not need complete screen-reader parity for MVP, but numeric inspector editing should provide an alternate path.

---

## 32. Empty and error states

### Empty canvas

Display subtle helper text:

> “Add a shape or choose a preset.”

Helper text disappears after first shape is added.

### Export failure

Show non-blocking toast:

> “Export failed. Try again.”

Log technical error locally/analytics if enabled.

### Unsupported SVG filter behavior

If browser feature detection fails, show:

> “Your browser cannot render this effect reliably. Try a current version of Chrome, Edge, Safari, or Firefox.”

---

## 33. Performance requirements

Target desktop hardware from the last five years.

Required:

- 60fps dragging for up to 20 primitives;
- no visible delay when changing width/height/radius;
- export under 2 seconds for normal SVG;
- 4× PNG export under 4 seconds for a typical 1000×1000 document.

Soft maximum:

50 primitives.

If over 50:

- permit editing;
- show no warning unless performance degrades.

---

## 34. Analytics

Only track product events needed to understand utility.

Suggested events:

```text
app_opened
preset_selected
shape_added
shape_duplicated
shape_deleted
goo_changed
export_opened
export_completed
export_failed
format_selected
reset_used
```

Useful properties:

- preset id;
- shape count;
- export format;
- PNG scale;
- session duration;
- whether document began blank.

Do not capture user artwork geometry unless explicitly disclosed and justified.

---

## 35. MVP acceptance criteria

The MVP is launch-ready when all of the following pass.

| Area | Acceptance criteria |
|---|---|
| Start | All eight reconstructed presets + Blank can create documents |
| Drag | Any primitive can be dragged fluidly |
| Resize | Width and height can be changed by handles and inspector |
| Radius | Radius can be changed live |
| Goo | Nearby primitives visibly merge and separate in real time |
| Add | New rounded rectangle can be added |
| Duplicate | Selected primitive can be duplicated |
| Delete | Selected primitive can be deleted |
| History | Undo/redo works for geometry and document actions |
| Reset | Reset restores loaded preset |
| Export SVG | Downloaded SVG visually matches editor in a browser |
| Export PNG | Transparent PNG downloads at requested scale |
| Bounds | Artwork export does not clip goo edges |
| Keyboard | Undo, redo, duplicate, delete, nudge work |
| Performance | 20-shape drag feels real-time on target browsers |
| Persistence | Optional: last document survives refresh via localStorage |

---

## 36. MVP scope

### Must ship

- start screen;
- Blank + eight presets;
- SVG canvas;
- rounded rectangles;
- drag;
- resize;
- radius;
- add;
- duplicate;
- delete;
- shared fill color;
- goo amount;
- edge softness;
- undo/redo;
- reset;
- zoom/pan;
- SVG export;
- PNG export;
- artwork/canvas bounds.

### Nice to have

- localStorage autosave;
- multi-select;
- align/distribute;
- shareable document JSON;
- keyboard shortcut sheet.

### Post-MVP

- Outline SVG;
- snapping;
- rotation;
- circles/ellipses as separate shape types;
- randomize;
- saved custom presets;
- gradient fills;
- animation;
- copy SVG to clipboard;
- Figma plugin;
- Framer component/embed;
- URL-encoded share state.

---

## 37. V1.1 feature recommendations

### 37.1 Outline SVG

Highest value follow-up.

### 37.2 Randomize

A button creates controlled variation by changing:

- primitive position;
- width;
- height;
- radius.

Keep the topology of the chosen preset.

Provide a “variation strength” control.

### 37.3 Copy SVG

One-click clipboard export.

### 37.4 Save custom preset

Store in localStorage.

### 37.5 More primitives

Ellipse and capsule.

---

## 38. V2 opportunities

Only consider these after measuring repeated use.

### Motion

Animate primitive positions so goo forms breathe and morph.

Export:

- CSS;
- SVG animation;
- GIF/video.

### Figma plugin

Generate the form inside a plugin and insert either:

- live SVG;
- outlined SVG;
- PNG.

### Developer export

Offer clean HTML/SVG snippet and React component.

### Shape packs

Additional topology presets:

- stairs;
- worm;
- arch;
- cross;
- frame;
- chain;
- maze;
- cloud;
- monogram-like forms.

---

## 39. Product design direction

The original charm came from restraint. Blendy should avoid the generic “creative tool dashboard” look.

Recommended direction:

- one accent color;
- generous empty space;
- compact controls;
- plain typography;
- no card-heavy inspector;
- minimal borders;
- no persistent tutorial overlays;
- playful preset names;
- artwork centered and large.

A user should understand the editor within seconds by moving a shape.

---

## 40. Recommended editor UI

```text
┌──────────────────────────────────────────────────────────────┐
│ Logo        Undo Redo       Fit 100%              Export     │
├───────────┬──────────────────────────────────┬───────────────┤
│ Presets   │                                  │ Shape         │
│           │                                  │               │
│ + Rect    │             CANVAS               │ X       312   │
│ + Circle  │                                  │ Y       284   │
│           │       [ gooey composition ]      │ W       260   │
│ Flecto    │                                  │ H       120   │
│ Fat       │                                  │ Radius   44   │
│ Twins     │                                  │               │
│ System 1  │                                  │ ───────────   │
│ System 2  │                                  │ Goo      50   │
│ Caption   │                                  │ Softness 15   │
│ éLe       │                                  │               │
│ Mirror    │                                  │ Delete        │
│           │                                  │               │
├───────────┴──────────────────────────────────┴───────────────┤
│ 100%                                                         │
└──────────────────────────────────────────────────────────────┘
```

---

## 41. Product decisions

### Why no rotation in MVP?

The defining visual language is orthogonal geometry. Rotation broadens the aesthetic toward generic blobs and adds transform complexity without strengthening the core concept.

### Why one shared color?

The goo filter is most predictable when all primitives belong to one silhouette. Multi-color compositing creates muddy connections and unclear export expectations.

### Why radius belongs per shape?

Radius materially changes the visual character and is one of the simplest ways to move between blocky and soft forms.

### Why semantic goo controls instead of raw filter controls?

Most designers should not need to understand `stdDeviation` or alpha matrices. Raw controls can exist in an Advanced panel later.

### Why SVG DOM over canvas libraries?

The source objects and final live export are already SVG primitives. Staying in SVG reduces translation layers.

---

## 42. QA scenarios

Core manual test matrix:

1. Load every preset.
2. Drag every primitive far enough to break goo connection.
3. Drag it back and verify the connection reforms.
4. Resize to minimum.
5. Resize to very large.
6. Set radius to 0.
7. Set radius to maximum.
8. Duplicate repeatedly.
9. Delete all shapes.
10. Undo back to original preset.
11. Redo forward.
12. Reset after heavy editing.
13. Export SVG at small and large bounds.
14. Open exported SVG in Chrome/Safari/Firefox.
15. Export transparent PNG.
16. Export PNG with background.
17. Verify goo is not clipped.
18. Pan/zoom while editing.
19. Reload with localStorage document.
20. Stress-test 20–50 shapes.

---

## 43. Browser support

Target:

- Chrome: current + previous major
- Edge: current + previous major
- Safari: current + previous major
- Firefox: current + previous major

Because SVG filter behavior can vary, export QA must include all four.

---

## 44. Legal/brand note

This specification reconstructs a product interaction pattern and technical effect.

For Blendy:

- do not reuse Flecto/Flectofy trademarks as the shipped product name;
- do not copy proprietary brand assets;
- create original visual identity;
- treat reconstructed preset geometry as inspiration and redraw/tune it independently.

The underlying SVG blur/alpha-threshold technique is a general web graphics technique.

---

## 45. Research basis and certainty

### High-confidence observations

The surviving indexed Flectofy page exposes:

- Undo;
- Width;
- Height;
- Reset;
- SVG;
- PNG;
- Save;
- Blank;
- The Flecto;
- The fat Flecto;
- Twins;
- System #1;
- System #2;
- Caption;
- The éLe;
- Mirror.

Contemporary descriptions identify Flectofy as a tool for building draggable gooey SVG forms.

Codrops connected Flectofy with a Creative Coding Club SVG-goo demonstration using draggable objects.

The reference goo implementation uses the established SVG pattern of:

- `feGaussianBlur`;
- `feColorMatrix`;
- alpha contrast/thresholding.

### Medium-confidence reconstruction

- rounded rectangles are the primary source geometry;
- presets are arrangements of those primitives;
- users modify the source primitives rather than a baked compound path;
- SVG export likely preserves some form of filter-based rendering.

### Product decisions introduced by this PRD

The following are modern implementation choices rather than verified original behavior:

- exact preset coordinates;
- right-side inspector;
- edge-softness control;
- add/duplicate/delete behavior;
- multi-selection;
- keyboard shortcuts;
- Outline SVG;
- state architecture;
- snapping;
- analytics;
- local persistence.

---

## 46. Research sources

Original tool:
https://flectofy.flecto.io/

Usetools listing:
https://www.usetools.design/tools/flectofy

Codrops Collective #757:
https://tympanus.net/codrops/collective/collective-757/

Zefi Flectofy listing:
https://www.zefi.ai/tools/flectofy

Smashing Magazine — Top Front-End Tools of 2023:
https://www.smashingmagazine.com/2024/01/top-frontend-tools-2023/

SVG Goo Configurator reference:
https://codepen.io/snorkltv/pen/ZEMjXxX

---

## 47. Recommended build order

### Phase 1 — Rendering prototype

Prove:

- two SVG rounded rectangles;
- live goo filter;
- dragging;
- reliable filter bounds.

### Phase 2 — Editor mechanics

Build:

- selection;
- resize;
- radius;
- add/delete;
- inspector;
- zoom/pan.

### Phase 3 — State

Build:

- preset loader;
- history;
- reset;
- local persistence.

### Phase 4 — Export

Build:

- SVG serializer;
- artwork bounds;
- PNG renderer;
- export UI.

### Phase 5 — Polish

Build:

- keyboard shortcuts;
- micro-interactions;
- empty states;
- onboarding hint;
- browser QA;
- responsive unsupported state.

### Phase 6 — V1.1

Build Outline SVG.

---

## 48. Definition of done

The product is done for MVP when a designer unfamiliar with the implementation can open it, choose a preset, reshape it visually without instruction, and export a usable result in under one minute.

The interaction should feel closer to playing with soft blocks than operating vector software.

That simplicity is the product.
