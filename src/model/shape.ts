export type ShapeType =
  | "roundedRect"
  | "ellipse"
  | "triangle"
  | "polygon"
  | "star"
  | "cube"
  | "cylinder"
  | "cone"
  | "pyramid"
  | "torus";

export type Shape = {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Corner rounding; doubles as cap depth on cylinder and cone. */
  radius: number;
  /** Degrees clockwise, about the shape centre. */
  rotation: number;
  /** polygon only */
  sides?: number;
  /** star only */
  points?: number;
  /** star waist and torus hole, as a fraction of the outer radius */
  innerRatio?: number;
  /** Overrides the document fill. */
  fill?: string;
  locked: boolean;
  hidden: boolean;
};

export const MIN_SIZE = 12;

/** Types whose outline is built from corners the radius can round off. */
export function supportsRadius(type: ShapeType) {
  return type !== "ellipse" && type !== "torus";
}

export function supportsSides(type: ShapeType) {
  return type === "polygon";
}

export function supportsPoints(type: ShapeType) {
  return type === "star";
}

export function supportsInnerRatio(type: ShapeType) {
  return type === "star" || type === "torus";
}

export function clampRadius(radius: number, width: number, height: number) {
  const max = Math.min(width, height) / 2;
  return Math.max(0, Math.min(radius, max));
}

export function clampSides(sides: number) {
  return Math.max(3, Math.min(12, Math.round(sides)));
}

export function clampPoints(points: number) {
  return Math.max(3, Math.min(12, Math.round(points)));
}

export function normalizeRotation(deg: number) {
  const wrapped = deg % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

export function clampInnerRatio(ratio: number) {
  return Math.max(0.1, Math.min(0.9, ratio));
}

type Blueprint = {
  label: string;
  width: number;
  height: number;
  /** Fraction of the smaller side. Small on acute corners: rounding a sharp tip pulls it inward. */
  radius: number;
  sides?: number;
  points?: number;
  innerRatio?: number;
};

export const SHAPE_BLUEPRINTS: Record<ShapeType, Blueprint> = {
  roundedRect: { label: "Rectangle", width: 160, height: 96, radius: 0.25 },
  ellipse: { label: "Ellipse", width: 150, height: 150, radius: 0 },
  triangle: { label: "Triangle", width: 150, height: 140, radius: 0.05 },
  polygon: { label: "Polygon", width: 150, height: 150, radius: 0.14, sides: 6 },
  star: { label: "Star", width: 160, height: 160, radius: 0.03, points: 5, innerRatio: 0.45 },
  cube: { label: "Cube", width: 150, height: 160, radius: 0.12 },
  cylinder: { label: "Cylinder", width: 130, height: 170, radius: 0.28 },
  cone: { label: "Cone", width: 150, height: 160, radius: 0.24 },
  pyramid: { label: "Pyramid", width: 160, height: 150, radius: 0.05 },
  torus: { label: "Torus", width: 170, height: 170, radius: 0, innerRatio: 0.44 },
};

export function blueprintFor(type: ShapeType, id: string, cx: number, cy: number): Shape {
  const blueprint = SHAPE_BLUEPRINTS[type];
  const { width, height } = blueprint;
  return {
    id,
    type,
    x: cx - width / 2,
    y: cy - height / 2,
    width,
    height,
    radius: clampRadius(Math.min(width, height) * blueprint.radius, width, height),
    rotation: 0,
    ...(blueprint.sides !== undefined ? { sides: blueprint.sides } : {}),
    ...(blueprint.points !== undefined ? { points: blueprint.points } : {}),
    ...(blueprint.innerRatio !== undefined ? { innerRatio: blueprint.innerRatio } : {}),
    locked: false,
    hidden: false,
  };
}
