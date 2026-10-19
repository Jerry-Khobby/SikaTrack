import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, ProviderBadge, ThemedText } from '@/components/atoms';
import { FontFamily, Radius } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type SmsInboxPreviewProps = {
  /** The MoMo senders SikaTrack reads, each shown highlighted. */
  senders: { name: string; providerCode: string }[];
};

/**
 * A sketch of a phone inbox: the MoMo senders stand out and every other
 * message is faded and locked. Decorative, so screen readers skip it.
 */
export function SmsInboxPreview({ senders }: SmsInboxPreviewProps) {
  const theme = useTheme();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.card, { backgroundColor: theme.surface }]}>
      {senders.map((sender) => (
        <Fragment key={sender.name}>
          <View
            style={[
              styles.row,
              styles.highlighted,
              { backgroundColor: theme.tintGold, borderColor: theme.borderGold },
            ]}>
            <ProviderBadge code={sender.providerCode} name={sender.name} size={30} />
            <View style={styles.lines}>
              <ThemedText type="fine" style={styles.sender} numberOfLines={1}>
                {sender.name}
              </ThemedText>
              <View style={[styles.bar, styles.barLong, { backgroundColor: theme.track }]} />
            </View>
          </View>
          <View style={[styles.row, styles.faded]}>
            <View style={[styles.avatar, { backgroundColor: theme.track }]} />
            <View style={styles.lines}>
              <View style={[styles.bar, styles.barShort, { backgroundColor: theme.toggleOff }]} />
              <View style={[styles.bar, styles.barLong, { backgroundColor: theme.track }]} />
            </View>
            <Icon name="lock" color={theme.text} size={14} />
          </View>
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'center',
    width: 250,
    padding: 14,
    gap: 8,
    borderRadius: 22,
    elevation: 4,
    shadowColor: '#1B2631',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
  },
  highlighted: {
    borderRadius: Radius.sm,
    borderWidth: 1.5,
  },
  faded: {
    opacity: 0.35,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  lines: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  sender: {
    fontFamily: FontFamily.bold,
  },
  bar: {
    height: 7,
    borderRadius: 4,
  },
  barShort: {
    width: 64,
  },
  barLong: {
    width: '85%',
  },
});
