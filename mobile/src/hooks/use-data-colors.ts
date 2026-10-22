import { DataColors, DataColorsDark, type DataPalette } from '@/theme/colors';

import { useColorScheme } from './use-color-scheme';

/** The chart colours for the current colour scheme (light or its validated dark twins). */
export function useDataColors(): DataPalette {
  return useColorScheme() === 'dark' ? DataColorsDark : DataColors;
}
