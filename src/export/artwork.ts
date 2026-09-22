import { CANVAS, type GooDocument } from "../model/document";
import { unionRects, shapesBounds } from "../geometry/bounds";
import { smoothFor } from "../goo/mapping";
import { gooOutline } from "../goo/trace";

/** Finer than the editor's sampling; export runs once, so it can afford the detail. */
const CELL = 0.6;
const PADDING = 24;

/** The traced artwork and the box around it: the goo plus padding, on a transparent ground. */
function artwork(doc: GooDocument) {
  const shapes = doc.shapes.filter((s) => !s.hidden);
  const outline = gooOutline({ shapes, smooth: smoothFor(doc.goo.amount), cell: CELL, defaultFill: doc.appearance.fill });
  const b = unionRects([outline.bounds, shapesBounds(shapes)].filter((r) => r !== null)) ?? { x: 0, y: 0, width: CANVAS, height: CANVAS };
  return { parts: outline.parts, box: { x: b.x - PADDING, y: b.y - PADDING, width: b.width + PADDING * 2, height: b.height + PADDING * 2 } };
}

const r = (v: number) => Math.round(v * 100) / 100;
const attr = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** Self-contained SVG, one path per colour: the goo is baked into the geometry. */
export function exportSvg(doc: GooDocument) {
  const { parts, box } = artwork(doc);
  const paths = parts.map((p) => `  <path fill="${attr(p.fill)}" fill-rule="evenodd" d="${p.d}"/>\n`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${r(box.width)}" height="${r(box.height)}" viewBox="${r(box.x)} ${r(box.y)} ${r(box.width)} ${r(box.height)}">\n${paths}</svg>\n`;
}

export function exportPng(doc: GooDocument, scale = 2): Promise<Blob> {
  const { parts, box } = artwork(doc);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(box.width * scale));
  canvas.height = Math.max(1, Math.round(box.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas 2D unavailable"));
  ctx.setTransform(scale, 0, 0, scale, -box.x * scale, -box.y * scale);
  for (const part of parts) {
    ctx.fillStyle = part.fill;
    ctx.fill(new Path2D(part.d), "evenodd");
  }
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode PNG"))), "image/png"));
}
