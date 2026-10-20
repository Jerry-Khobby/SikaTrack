/**
 * How a colour token in colors.ts is named in Tailwind classes. Shared by
 * tailwind.config.js and the runtime theme variables, so the two always agree.
 *
 *   text, textSecondary  → content, content-secondary   (text-content-secondary)
 *   border, borderInput  → line, line-input             (border-line-input)
 *   tintBlue, iconBlue   → tint-blue, icon-blue         (bg-tint-blue)
 */
function kebab(name) {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function tailwindColorName(token) {
  if (token === 'text') return 'content';
  if (token.startsWith('text')) return `content-${kebab(token.slice(4)).replace(/^-/, '')}`;
  if (token === 'border') return 'line';
  if (token.startsWith('border')) return `line-${kebab(token.slice(6)).replace(/^-/, '')}`;
  return kebab(token);
}

/** The CSS variable that holds a theme colour, e.g. `--color-content-secondary`. */
function cssVariable(token) {
  return `--color-${tailwindColorName(token)}`;
}

module.exports = { tailwindColorName, cssVariable };
