import { StyleSheet, View } from 'react-native';

import { Button, ThemedText } from '@/components/atoms';
import { FontFamily } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

import { IconCircle } from './icon-circle';

export type ErrorStateProps = {
  title: string;
  message?: string;
  /** The response's `X-Request-ID`, so support can trace it. */
  requestId?: string;
  onRetry: () => void;
};

/** A short message, a Try again button and the request ID (docs/ui-spec.md G7). */
export function ErrorState({
  title,
  message = 'Something went wrong on our side. Your data is safe.',
  requestId,
  onRetry,
}: ErrorStateProps) {
  const theme = useTheme();

  return (
    <View accessibilityRole="alert" style={[styles.card, { backgroundColor: theme.surface }]}>
      <IconCircle icon="alert" tone="neutral" size={64} />
      <ThemedText type="heading" style={styles.title}>
        {title}
      </ThemedText>
      <ThemedText type="callout" themeColor="textSecondary" style={styles.message}>
        {message}
      </ThemedText>
      <View style={styles.action}>
        <Button variant="secondary" label="Try again" onPress={onRetry} />
      </View>
      {requestId && (
        <ThemedText type="fine" themeColor="textSecondary" selectable style={styles.ref}>
          Ref: {requestId}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderRadius: 22,
  },
  title: {
    fontFamily: FontFamily.extraBold,
    fontSize: 18,
    textAlign: 'center',
  },
  message: {
    maxWidth: 270,
    textAlign: 'center',
  },
  action: {
    minWidth: 180,
  },
  ref: {
    fontFamily: 'monospace',
    fontSize: 11,
  },
});
