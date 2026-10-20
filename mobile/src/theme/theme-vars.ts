import { vars } from 'nativewind';

import { Colors } from './colors';
import { cssVariable } from './tailwind-names';

function toVariables(palette: Record<string, string>) {
  return vars(Object.fromEntries(Object.entries(palette).map(([token, value]) => [cssVariable(token), value])));
}

/**
 * The theme colours as CSS variables, one set per colour scheme. The root layout
 * puts the right set on the app's outer view, so every `bg-surface` or
 * `text-content` underneath follows light and dark mode.
 */
export const ThemeVariables = {
  light: toVariables(Colors.light),
  dark: toVariables(Colors.dark),
};
