import { clampRadius, type Shape, type ShapeType } from "../model/shape";
import { uid } from "../utils/ids";

type Rng = () => number;
type Block = { x: number; y: number; w: number; h: number };

const rand = (rng: Rng, min: number, max: number) => min + rng() * (max - min);
const int = (rng: Rng, min: number, max: number) => Math.floor(rand(rng, min, max + 1));
const coin = (rng: Rng, odds = 0.5) => rng() < odds;

/**
 * Compositions are laid out on an implicit grid rather than scattered, because
 * the goo reads as one deliberate form only when its parts share an alignment.
 * Each archetype fixes a topology and randomises the proportions inside it.
 */
const OVERLAP = 0.6;

function stack(rng: Rng): Block[] {
  const rows = int(rng, 2, 4);
  const blocks: Block[] = [];
  let y = 0;
  for (let i = 0; i < rows; i += 1) {
    const w = rand(rng, 5, 11);
    const h = rand(rng, 2, 3.4);
    blocks.push({ x: -w / 2 + rand(rng, -1.6, 1.6), y, w, h });
    y += h - OVERLAP;
  }
  return blocks;
}

function row(rng: Rng): Block[] {
  const cols = int(rng, 2, 4);
  const blocks: Block[] = [];
  let x = 0;
  for (let i = 0; i < cols; i += 1) {
    const h = rand(rng, 5, 11);
    const w = rand(rng, 2, 3.4);
    blocks.push({ x, y: -h / 2 + rand(rng, -1.6, 1.6), w, h });
    x += w - OVERLAP;
  }
  return blocks;
}

function ell(rng: Rng): Block[] {
  const thick = rand(rng, 2.6, 4);
  const tall = rand(rng, 7, 11);
  const wide = rand(rng, 5, 9);
  const flip = coin(rng) ? 1 : -1;
  return [
    { x: 0, y: 0, w: thick, h: tall },
    { x: flip > 0 ? thick - OVERLAP : thick - wide, y: tall - thick, w: wide, h: thick },
  ];
}

function tee(rng: Rng): Block[] {
  const thick = rand(rng, 2.6, 4);
  const bar = rand(rng, 8, 12);
  const stem = rand(rng, 5, 8);
  const at = rand(rng, 0.2, 0.8) * (bar - thick);
  return coin(rng)
    ? [
        { x: 0, y: 0, w: bar, h: thick },
        { x: at, y: thick - OVERLAP, w: thick, h: stem },
      ]
    : [
        { x: 0, y: 0, w: thick, h: bar },
        { x: thick - OVERLAP, y: at, w: stem, h: thick },
      ];
}

function cross(rng: Rng): Block[] {
  const thick = rand(rng, 2.8, 4.2);
  const a = rand(rng, 8, 12);
  const b = rand(rng, 8, 12);
  return [
    { x: 0, y: (b - thick) / 2, w: a, h: thick },
    { x: rand(rng, 0.25, 0.6) * (a - thick), y: 0, w: thick, h: b },
  ];
}

function stair(rng: Rng): Block[] {
  const steps = int(rng, 3, 4);
  const dir = coin(rng) ? 1 : -1;
  const blocks: Block[] = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i < steps; i += 1) {
    const w = rand(rng, 3, 4.5);
    const h = rand(rng, 3, 4.5);
    blocks.push({ x: dir > 0 ? x : -x - w, y, w, h });
    // Step by the block's own size so consecutive treads always share area.
    x += w - OVERLAP;
    y += h - OVERLAP;
  }
  return blocks;
}

function cluster(rng: Rng): Block[] {
  const core = rand(rng, 4.5, 6.5);
  const blocks: Block[] = [{ x: 0, y: 0, w: core, h: core * rand(rng, 0.8, 1.25) }];
  const sides = [0, 1, 2, 3].sort(() => rng() - 0.5).slice(0, int(rng, 2, 3));
  for (const side of sides) {
    const w = rand(rng, 2.6, 4.5);
    const h = rand(rng, 2.6, 4.5);
    const base = blocks[0];
    const slideX = rand(rng, 0, base.w - w);
    const slideY = rand(rng, 0, base.h - h);
    if (side === 0) blocks.push({ x: slideX, y: -h + OVERLAP, w, h });
    else if (side === 1) blocks.push({ x: base.w - OVERLAP, y: slideY, w, h });
    else if (side === 2) blocks.push({ x: slideX, y: base.h - OVERLAP, w, h });
    else blocks.push({ x: -w + OVERLAP, y: slideY, w, h });
  }
  return blocks;
}

const ARCHETYPES = [stack, row, ell, tee, cross, stair, cluster];

export function generateComposition(
  canvasWidth: number,
  canvasHeight: number,
  rng: Rng = Math.random,
): Shape[] {
  const blocks = ARCHETYPES[Math.floor(rng() * ARCHETYPES.length)](rng);

  // One shape family and one corner ratio per composition; mixing them is what
  // made earlier results read as debris rather than a single object.
  const type: ShapeType = coin(rng, 0.25) ? "ellipse" : "roundedRect";
  const roundness = type === "ellipse" ? 0 : rand(rng, 0.18, 0.5);

  const left = Math.min(...blocks.map((b) => b.x));
  const top = Math.min(...blocks.map((b) => b.y));
  const right = Math.max(...blocks.map((b) => b.x + b.w));
  const bottom = Math.max(...blocks.map((b) => b.y + b.h));

  const scale = Math.min(
    (canvasWidth * 0.62) / (right - left),
    (canvasHeight * 0.62) / (bottom - top),
  );
  const offsetX = canvasWidth / 2 - ((left + right) / 2) * scale;
  const offsetY = canvasHeight / 2 - ((top + bottom) / 2) * scale;

  return blocks.map((b) => {
    const width = Math.round(b.w * scale);
    const height = Math.round(b.h * scale);
    return {
      id: uid(),
      type,
      x: Math.round(b.x * scale + offsetX),
      y: Math.round(b.y * scale + offsetY),
      width,
      height,
      radius: clampRadius(Math.min(width, height) * roundness, width, height),
      rotation: 0,
      locked: false,
      hidden: false,
    };
  });
}
