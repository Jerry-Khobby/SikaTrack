import type { ReactNode } from 'react';
import { KeyboardAvoidingView, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton, ThemedText, ThemedView } from '@/components/atoms';
import { OfflineBanner } from '@/components/molecules';
import { useOffline } from '@/hooks/use-offline';
import { useTheme } from '@/hooks/use-theme';

type DetailTemplateProps = {
  /** Leave out for a page whose content has its own big heading. */
  title?: string;
  onBack: () => void;
  /** A control at the right of the header, e.g. "Mark all as read". */
  action?: ReactNode;
  children: ReactNode;
  /** `regular` (20 px gutters) or `narrow` (16 px), as the page's design asks. */
  gutter?: 'regular' | 'narrow';
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Pinned under the content, e.g. Save; stays above the keyboard. */
  footer?: ReactNode;
};

/** An inner page: back arrow and title in a header row, scrolling content under it. */
export function DetailTemplate({
  title,
  onBack,
  action,
  children,
  gutter = 'regular',
  refreshing,
  onRefresh,
  footer,
}: DetailTemplateProps) {
  const theme = useTheme();
  const offline = useOffline();

  return (
    <ThemedView className="flex-1 flex-row justify-center">
      <SafeAreaView className="max-w-content flex-1">
        {offline && <OfflineBanner />}
        <View className="flex-row items-center gap-1 px-3 pb-2 pt-3">
          <IconButton icon="chevron-left" accessibilityLabel="Back" onPress={onBack} />
          <View className="flex-1">
            {title && (
              <ThemedText type="heading" accessibilityRole="header">
                {title}
              </ThemedText>
            )}
          </View>
          {action}
        </View>
        <KeyboardAvoidingView behavior="padding" className="flex-1">
          <ScrollView
            contentContainerClassName={`gap-3 pb-8 pt-2 ${gutter === 'narrow' ? 'px-4' : 'px-5'}`}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={theme.text} />
              ) : undefined
            }>
            {children}
          </ScrollView>
          {footer && <View className={`gap-2 pb-4 pt-2 ${gutter === 'narrow' ? 'px-4' : 'px-5'}`}>{footer}</View>}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}
