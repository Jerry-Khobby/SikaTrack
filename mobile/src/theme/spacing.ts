/**
 * Sizes Tailwind reads from here (tailwind.config.js): `rounded-sm`/`md`/`lg`/`xl`,
 * `h-touch`, `h-button`, `h-input` and `max-w-content`. Everyday spacing uses
 * Tailwind's own scale (`p-4` = 16 px).
 */

export const Radius = {
  sm: 12,
  md: 14,
  lg: 18,
  xl: 26,
} as const;

/** Minimum heights for things people tap or type into. */
export const ControlHeight = {
  touch: 44,
  button: 54,
  input: 60,
} as const;

export const MaxContentWidth = 800;
