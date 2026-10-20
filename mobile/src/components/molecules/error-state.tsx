import { View } from 'react-native';

import { Button, ThemedText } from '@/components/atoms';

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
  return (
    <View accessibilityRole="alert" className="items-center gap-3 rounded-[22px] bg-surface px-5 py-8">
      <IconCircle icon="alert" tone="neutral" size={64} />
      <ThemedText type="none" className="text-center font-sans-extrabold text-[18px] leading-[26px]">
        {title}
      </ThemedText>
      <ThemedText type="callout" themeColor="textSecondary" className="max-w-[270px] text-center">
        {message}
      </ThemedText>
      <View className="min-w-[180px]">
        <Button variant="secondary" label="Try again" onPress={onRetry} />
      </View>
      {requestId && (
        <ThemedText type="none" themeColor="textSecondary" selectable className="font-mono text-[11px] leading-[18px]">
          Ref: {requestId}
        </ThemedText>
      )}
    </View>
  );
}
