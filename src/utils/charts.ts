/** The smallest round whole number at or above `raw`, for evenly spaced axis ticks. */
export function niceStep(raw: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  for (const factor of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    const step = factor * magnitude;
    if (step >= raw && Number.isInteger(step)) return step;
  }
  return 10 * magnitude;
}

/** Axis tick text: 12000 → "12K". */
export function formatTick(value: number): string {
  return value >= 10000 ? `${Math.round(value / 1000)}K` : String(value);
}

/** `part` as a whole percentage of `whole`; 0 when there's no whole. */
export function percentOf(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/** `part` as a share of `whole`, for labels: "64%", or "<1%" for a small share that isn't zero. */
export function formatShare(part: number, whole: number): string {
  const percent = percentOf(part, whole);
  return percent === 0 && part > 0 ? '<1%' : `${percent}%`;
}
