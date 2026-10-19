import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/atoms';
import { CodeInput, InfoNote, ResendCountdown } from '@/components/molecules';
import { ControlHeight, Spacing } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type CodeEntryProps = {
  code: string;
  length: number;
  onChangeCode: (code: string) => void;
  /** True while the code is being checked; a spinner replaces the boxes. */
  checking: boolean;
  error?: string;
  /** Set when the code can no longer be used, e.g. after too many wrong tries. */
  locked?: boolean;
  shakeKey: number;
  secondsUntilResend: number;
  onResend: () => void;
  expiresInMinutes: number;
};

/** The code boxes with their resend countdown, expiry line and autofill tip. */
export function CodeEntry({
  code,
  length,
  onChangeCode,
  checking,
  error,
  locked,
  shakeKey,
  secondsUntilResend,
  onResend,
  expiresInMinutes,
}: CodeEntryProps) {
  const theme = useTheme();

  return (
    <View>
      {checking ? (
        <View style={styles.checking}>
          <ActivityIndicator color={theme.text} accessibilityLabel="Checking the code" />
        </View>
      ) : (
        <CodeInput
          value={code}
          length={length}
          onChangeText={onChangeCode}
          invalid={Boolean(error)}
          editable={!locked}
          shakeKey={shakeKey}
        />
      )}
      {error && (
        <ThemedText
          type="caption"
          themeColor="error"
          accessibilityLiveRegion="polite"
          style={styles.error}>
          {error}
        </ThemedText>
      )}
      <View style={styles.timing}>
        <ResendCountdown secondsLeft={secondsUntilResend} onResend={onResend} />
        <ThemedText type="callout" themeColor="textSecondary">
          The code expires in {expiresInMinutes} minutes.
        </ThemedText>
      </View>
      <View style={styles.note}>
        <InfoNote icon="message" text="We'll fill the code in for you when the SMS arrives." />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  checking: {
    height: ControlHeight.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    marginTop: 12,
  },
  timing: {
    marginTop: Spacing.four,
    gap: 6,
  },
  note: {
    marginTop: Spacing.four,
  },
});
