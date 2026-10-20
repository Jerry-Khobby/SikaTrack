import { Pressable, Text, View } from 'react-native';

export type HeatmapProps = {
  /** Down the left, e.g. Mon–Sun. */
  rows: string[];
  /** Along the top, e.g. Morning–Night. */
  columns: string[];
  /** `values[row][column]`. */
  values: number[][];
  /** The one hue that darkens with the amount (a sequential scale). */
  color: string;
  /** The figure printed in each cell, e.g. `392`. */
  formatValue: (value: number) => string;
  /** What a screen reader hears for a cell, e.g. `Monday afternoon, GHS 392.90`. */
  cellLabel: (row: number, column: number) => string;
  selected?: { row: number; column: number } | null;
  onSelect?: (row: number, column: number) => void;
};

/** Hex `#2a78d6` and an alpha → `rgba(42, 120, 214, 0.5)`. */
function withAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha.toFixed(2)})`;
}

/** Fill strength for a value: faint for little, full for the most. */
export const heatAlpha = (value: number, max: number) => (max > 0 ? 0.08 + 0.92 * (value / max) : 0.08);

/** A grid of cells shaded by amount, each with its figure written in it. */
export function Heatmap({ rows, columns, values, color, formatValue, cellLabel, selected, onSelect }: HeatmapProps) {
  const max = Math.max(0, ...values.flat());

  return (
    <View className="gap-[5px]">
      <View className="flex-row gap-[5px]" accessible={false} importantForAccessibility="no-hide-descendants">
        <View className="w-10" />
        {columns.map((column) => (
          <Text key={column} numberOfLines={1} className="flex-1 text-center font-sans text-[10px] leading-[12px] text-content-secondary">
            {column}
          </Text>
        ))}
      </View>
      {rows.map((row, r) => (
        <View key={row} className="flex-row items-center gap-[5px]">
          <Text className="w-10 font-sans-bold text-[12px] text-content">{row}</Text>
          {columns.map((_, c) => {
            const value = values[r]?.[c] ?? 0;
            const alpha = heatAlpha(value, max);
            const isSelected = selected?.row === r && selected?.column === c;
            return (
              <Pressable
                key={c}
                accessibilityRole={onSelect ? 'button' : 'text'}
                accessibilityLabel={cellLabel(r, c)}
                accessibilityState={onSelect ? { selected: isSelected } : undefined}
                disabled={!onSelect}
                onPress={() => onSelect?.(r, c)}
                className={`h-[34px] flex-1 items-center justify-center rounded-lg ${isSelected ? 'border-2 border-line-focus' : ''}`}
                // The shade is the data, so it stays a computed value.
                style={{ backgroundColor: withAlpha(color, alpha) }}>
                <Text
                  numberOfLines={1}
                  className={`font-sans-semibold text-[10px] ${alpha > 0.55 ? 'text-white' : 'text-content'}`}
                  style={{ fontVariant: ['tabular-nums'] }}>
                  {formatValue(value)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** The key under a heatmap: the lightest and darkest shade with what they stand for. */
export function HeatmapLegend({ color, low, high }: { color: string; low: string; high: string }) {
  return (
    <View className="mt-3 flex-row items-center gap-2">
      <Text className="font-sans text-[11px] text-content-secondary">{low}</Text>
      <View className="h-2 max-w-[140px] flex-1 flex-row overflow-hidden rounded">
        {[0.08, 0.31, 0.54, 0.77, 1].map((alpha) => (
          <View key={alpha} className="flex-1" style={{ backgroundColor: withAlpha(color, alpha) }} />
        ))}
      </View>
      <Text className="font-sans text-[11px] text-content-secondary">{high}</Text>
    </View>
  );
}
