import { clamp } from "../utils/clamp";

/** Goo amount (0-100) to fillet radius in canvas units. */
export const smoothFor = (amount: number) => (clamp(amount, 0, 100) / 100) * 80;
