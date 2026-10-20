import { ActivityIndicator, View } from 'react-native';

import { ThemedText } from '@/components/atoms';
import { CodeInput, InfoNote, ResendCountdown } from '@/components/molecules';
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
        <View className="h-input items-center justify-center">
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
        <ThemedText type="caption" themeColor="error" accessibilityLiveRegion="polite" className="mt-3">
          {error}
        </ThemedText>
      )}
      <View className="mt-6 gap-1.5">
        <ResendCountdown secondsLeft={secondsUntilResend} onResend={onResend} />
        <ThemedText type="callout" themeColor="textSecondary">
          The code expires in {expiresInMinutes} minutes.
        </ThemedText>
      </View>
      <View className="mt-6">
        <InfoNote icon="message" text="We'll fill the code in for you when the SMS arrives." />
      </View>
    </View>
  );
}
