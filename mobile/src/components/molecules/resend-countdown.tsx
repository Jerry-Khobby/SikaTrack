import { TextLink, ThemedText } from '@/components/atoms';

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
      <ThemedText type="none" className="font-sans-bold">
        {formatSeconds(secondsLeft)}
      </ThemedText>
    </ThemedText>
  );
}
