/// <reference types="node" />
/**
 * Rules NativeWind can't check for us. A class that sets a CSS variable
 * (shadows, transforms) and is only added after the first render makes
 * NativeWind remount the view; in development it then prints a warning that
 * crashes with "Couldn't find a LinkingContext context". Those values change
 * through inline `style` instead.
 */
import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..');
const VARIABLE_CLASSES = /\b(shadow|rotate|scale|translate|skew)(-[\w[\]./%-]+)?\b/;

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    return full.endsWith('.tsx') && !full.endsWith('.test.tsx') ? [full] : [];
  });
}

/** The branches of every `cond ? 'a' : 'b'` that sits inside a className. */
function toggledClassStrings(source: string) {
  const found: string[] = [];
  for (const match of source.matchAll(/className=\{`([^`]*)`\}/g)) {
    for (const branch of match[1].matchAll(/\?\s*'([^']*)'\s*:\s*'([^']*)'/g)) {
      found.push(branch[1], branch[2]);
    }
  }
  for (const match of source.matchAll(/className=\{[^`}]*\?\s*'([^']*)'\s*:\s*'([^']*)'\s*\}/g)) {
    found.push(match[1], match[2]);
  }
  return found;
}

describe('styling rules', () => {
  const files = sourceFiles(SRC);

  it('finds the source files', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('never toggles shadow or transform classes after the first render', () => {
    const offenders = files.flatMap((file) =>
      toggledClassStrings(fs.readFileSync(file, 'utf8'))
        .filter((classes) => VARIABLE_CLASSES.test(classes))
        .map((classes) => `${path.relative(SRC, file)}: "${classes}"`),
    );
    expect(offenders).toEqual([]);
  });

  it('catches the pattern it guards against', () => {
    expect(toggledClassStrings("className={`p-2 ${on ? 'shadow-sm' : ''}`}")).toContain('shadow-sm');
    expect(toggledClassStrings("className={open ? 'rotate-180' : ''}")).toContain('rotate-180');
  });
});
