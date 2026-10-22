import { Text, View } from 'react-native';

export type FigureTileProps = {
  label: string;
  /** The figure itself, e.g. `28%`, or a short sentence for the ink tile. */
  value: string;
  /** What the figure counts, e.g. `of spending`. */
  caption?: string;
  /** Brand ink, for the one headline tile in a row. */
  ink?: boolean;
  /** Fixed width inside a sideways-scrolling row; leave out to share a grid. */
  width?: number;
  /** Smaller figure, for three tiles side by side. */
  compact?: boolean;
};

/** A labelled figure on its own card, e.g. "Weekends · 28% · of spending". */
export function FigureTile({ label, value, caption, ink, width, compact }: FigureTileProps) {
  return (
    <View
      accessible
      accessibilityLabel={[label, value, caption].filter(Boolean).join(', ')}
      className={`rounded-[18px] p-[14px] ${ink ? 'bg-hero' : 'bg-surface'} ${width ? '' : 'flex-1'}`}
      style={width ? { width } : undefined}>
      <Text className={`font-sans text-[12px] leading-[16px] ${ink ? 'text-brand-on-ink-muted' : 'text-content-secondary'}`}>{label}</Text>
      <Text
        // Figures never break mid-word: a sentence (the ink tile) wraps, a figure shrinks to fit.
        numberOfLines={ink ? undefined : 1}
        adjustsFontSizeToFit={!ink}
        className={`mt-1 font-sans-extrabold ${
          ink ? 'text-[15px] leading-[20px] text-brand-on-ink' : compact ? 'text-[16px] leading-[22px] text-content' : 'text-[20px] leading-[26px] text-content'
        }`}>
        {value}
      </Text>
      {caption && <Text className="font-sans text-[12px] leading-[16px] text-content-secondary">{caption}</Text>}
    </View>
  );
}
