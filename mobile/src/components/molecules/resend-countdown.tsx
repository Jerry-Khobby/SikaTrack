import { StyleSheet } from 'react-native';

import { TextLink, ThemedText } from '@/components/atoms';
import { FontFamily } from '@/theme';

export type ResendCountdownProps = {
  secondsLeft: number;
  onResend: () => void;
};

function formatSeconds(total: number) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** "Resend code in 0:42", which turns into a Resend code link at zero. */
export function ResendCountdown({ secondsLeft, onResend }: ResendCountdownProps) {
  if (secondsLeft <= 0) {
    return (
      <ThemedText type="callout">
        <TextLink bold onPress={onResend}>
          Resend code
        </TextLink>
      </ThemedText>
    );
  }

  return (
    <ThemedText type="callout" themeColor="textSecondary">
      Resend code in{' '}
      <ThemedText type="callout" style={styles.time}>
        {formatSeconds(secondsLeft)}
      </ThemedText>
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  time: {
    fontFamily: FontFamily.bold,
  },
});
