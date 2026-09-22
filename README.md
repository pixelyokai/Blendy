# Blendy

Browser-based generative SVG shape editor. Compose with simple shapes, render as one organic gooey form, export as SVG or PNG.

Built from `blendy_prd.md` (MVP scope).

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production bundle in dist/
npm run preview
```

## What ships

- Opens on the Totem preset, or on your last session restored from localStorage.
- Light and dark themes (follows the system until you pick one), with tooltips on every icon button and animated menus, tooltips and toasts. Screens under 480px get a desktop-only notice.
- The goo is real geometry. Shapes keep their exact outlines; each point blends its nearest shapes with a continuous-curvature fillet, so joins flow in without seams and only ever connect different shapes. Each shape can override the document fill; joins between colours split down the middle.
- Fixed 1000x1000 artboard; shapes stay on it when dragged, nudged, dropped or pasted. Zoom to 300% (Ctrl/Cmd + scroll zooms at the pointer; scrolling only moves within the artboard).
- Toggleable rulers (with the selection's span highlighted) and pixel grid (drags land on whole units while it is on).
- Smart guides: dragging snaps edges and centres to other shapes and the artboard (hold Ctrl/Cmd to disable).
- Ten primitives and ten presets; click to add at the centre, or drag onto the canvas. Presets add to the canvas rather than replacing it.
- Generate builds a random composition from a grid archetype; Reset clears the canvas.
- Drag, resize (Shift keeps ratio, Alt from centre), rotate (Shift snaps to 15°), radius handle, Alt + drag to duplicate, marquee selection.
- Align with Alt + A / D / W / S / H / V, copy / cut / paste across tabs, duplicate, nudge, undo/redo (100 steps). Every shortcut is listed under the help button.
- Bend: dragged blocks trail the pointer on a spring and settle back.
- Export as SVG (one path per colour, no filters) or PNG at 2x, cropped to the artwork with padding.

## Architecture

```
src/
  editor/     React components (Canvas, Header, Toolbar, Sidebar, Fields, Rulers) and ui/ (icons, tooltips, menus)
  model/      document + shape + preset instantiation
  state/      Zustand stores: the document with history, and view preferences
  geometry/   bounds, resize, rotation, snapping, shape paths, drag bend
  goo/        the vector outline: distance fields, fillet blend, marching squares, exact refinement; worker.ts runs the sharp pass off the main thread
  presets/    preset definitions and the random generator
  export/     SVG and PNG export
  utils/      ids, clamp, download
```

The geometry and goo modules are plain TypeScript that runs in Node; only PNG export needs a browser canvas. The X and GitHub links live in `src/editor/Header.tsx`.

## Deploy

Fully client-side; deploy to Vercel with framework preset **Vite** (build `npm run build`, output `dist`). No environment variables are required.

## Not in this build

Gradients and animation.
