import { ScrollView, StyleSheet } from 'react-native';

import { InsightCard } from '@/components/molecules';
import type { Insight } from '@/services/insights';

export type InsightCarouselProps = {
  insights: Insight[];
  onOpen: (insight: Insight) => void;
};

/** The insight cards in a row that scrolls sideways, in the order the API sends them. */
export function InsightCarousel({ insights, onOpen }: InsightCarouselProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityLabel="Insights">
      {insights.map((insight) => (
        <InsightCard
          key={insight.id}
          severity={insight.severity}
          title={insight.title}
          body={insight.body}
          onPress={insight.link ? () => onOpen(insight) : undefined}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 10,
    paddingHorizontal: 16,
  },
});
