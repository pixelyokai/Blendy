type PresetShape = { x: number; y: number; width: number; height: number; radius: number };
export type Preset = { id: string; name: string; shapes: PresetShape[] };

const rect = (x: number, y: number, width: number, height: number, radius: number) => ({
  x,
  y,
  width,
  height,
  radius,
});

export const PRESETS: Preset[] = [
  {
    id: "totem",
    name: "Totem",
    shapes: [rect(350, 300, 250, 110, 38), rect(300, 425, 300, 110, 38), rect(350, 550, 250, 110, 38)],
  },
  { id: "plinth", name: "Plinth", shapes: [rect(315, 300, 360, 210, 56), rect(245, 485, 510, 155, 52)] },
  { id: "pillars", name: "Pillars", shapes: [rect(300, 295, 210, 380, 58), rect(490, 325, 210, 350, 58)] },
  { id: "steps", name: "Steps", shapes: [rect(260, 320, 480, 170, 52), rect(330, 475, 420, 170, 52)] },
  { id: "ledge", name: "Ledge", shapes: [rect(245, 470, 520, 150, 48), rect(245, 380, 165, 180, 48)] },
  { id: "elbow", name: "Elbow", shapes: [rect(330, 325, 160, 360, 50), rect(330, 525, 355, 160, 50)] },
  { id: "cross", name: "Cross", shapes: [rect(300, 430, 410, 150, 48), rect(430, 300, 150, 410, 48)] },
  { id: "mirror", name: "Mirror", shapes: [rect(285, 350, 245, 300, 60), rect(470, 350, 245, 300, 60)] },
  { id: "arch", name: "Arch", shapes: [rect(290, 300, 420, 150, 56), rect(290, 300, 150, 400, 56), rect(560, 300, 150, 400, 56)] },
  { id: "tee", name: "Tee", shapes: [rect(270, 300, 460, 160, 54), rect(425, 300, 150, 420, 54)] },
];

/** Ids from earlier versions; saved documents may still carry them. */
const LEGACY_IDS: Record<string, string> = {
  "the-flecto": "totem",
  stack: "totem",
  "fat-flecto": "plinth",
  "fat-stack": "plinth",
  twins: "pillars",
  "system-1": "steps",
  "system-2": "ledge",
  caption: "elbow",
  ele: "cross",
};

export const getPreset = (id: string) => PRESETS.find((p) => p.id === (LEGACY_IDS[id] ?? id));
