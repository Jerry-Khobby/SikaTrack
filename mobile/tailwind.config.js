/**
 * Tailwind for the app (NativeWind). Every value comes from src/theme, so the
 * classes and the design tokens can't drift apart.
 */
const { BrandColors, Colors, DataColors } = require('./src/theme/colors.ts');
const { ControlHeight, MaxContentWidth, Radius } = require('./src/theme/spacing.ts');
const { cssVariable, tailwindColorName } = require('./src/theme/tailwind-names.js');

const kebab = (name) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** Theme colours switch with light and dark mode through CSS variables. */
const themeColors = Object.fromEntries(
  Object.keys(Colors.light).map((token) => [tailwindColorName(token), `var(${cssVariable(token)})`]),
);

/** Brand and chart colours are the same in both modes. */
const brandColors = Object.fromEntries(
  Object.entries(BrandColors).map(([token, value]) => [`brand-${kebab(token)}`, value]),
);
const chartColors = {
  ...Object.fromEntries(DataColors.categories.map((value, index) => [`chart-${index + 1}`, value])),
  'chart-other': DataColors.categoryOther,
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: { ...themeColors, ...brandColors, ...chartColors },
      fontFamily: {
        sans: ['PlusJakartaSans_400Regular'],
        'sans-medium': ['PlusJakartaSans_500Medium'],
        'sans-semibold': ['PlusJakartaSans_600SemiBold'],
        'sans-bold': ['PlusJakartaSans_700Bold'],
        'sans-extrabold': ['PlusJakartaSans_800ExtraBold'],
        mono: ['monospace'],
      },
      borderRadius: {
        sm: `${Radius.sm}px`,
        md: `${Radius.md}px`,
        lg: `${Radius.lg}px`,
        xl: `${Radius.xl}px`,
      },
      height: {
        touch: `${ControlHeight.touch}px`,
        button: `${ControlHeight.button}px`,
        input: `${ControlHeight.input}px`,
      },
      minHeight: {
        touch: `${ControlHeight.touch}px`,
        button: `${ControlHeight.button}px`,
      },
      width: {
        touch: `${ControlHeight.touch}px`,
      },
      maxWidth: {
        content: `${MaxContentWidth}px`,
      },
    },
  },
  plugins: [],
};
