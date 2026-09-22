export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function round(value: number, decimals = 2) {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
