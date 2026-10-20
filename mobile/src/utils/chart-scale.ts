/**
 * Axis maths for the charts: round tick values so every chart's y-axis reads as
 * clean numbers (0 / 2K / 4K), never 0 / 1,333 / 2,667.
 */

const NICE_STEPS = [1, 2, 2.5, 5, 10];

/**
 * Ticks from 0 up to at least `max`, about `count` steps apart, on round numbers.
 * `top` is the last tick, which the chart uses as its full height.
 */
export function niceTicks(max: number, count = 3): { top: number; ticks: number[] } {
  if (!(max > 0)) return { top: 1, ticks: [0, 1] };
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = NICE_STEPS.find((s) => s * magnitude >= raw)! * magnitude;
  const top = Math.ceil(max / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let value = 0; value <= top + step / 2; value += step) ticks.push(round(value));
  return { top: round(top), ticks };
}

const round = (value: number) => Math.round(value * 1000) / 1000;

/** A tick label: `0`, `250`, `2.5`, `1K`, `1.5K`, `2M`. */
export function formatTick(value: number) {
  if (value >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (value >= 1000) return `${trim(value / 1000)}K`;
  return trim(value);
}

const trim = (value: number) => String(Math.round(value * 10) / 10);
