import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, ThemedText } from '@/components/atoms';

export type BottomSheetProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Pinned under the scrolling content, e.g. Reset and Save. */
  footer?: ReactNode;
  /** Fill most of the screen instead of fitting the content. */
  tall?: boolean;
};

/** A sheet that slides up over a dimmed screen. Mount it to open it; unmount it to close. */
export function BottomSheet({ title, onClose, children, footer, tall }: BottomSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" className="flex-1 justify-end">
        <Pressable accessibilityLabel="Close" onPress={onClose} className="absolute inset-0 bg-overlay" />
        <View
          accessibilityViewIsModal
          className={`absolute inset-x-0 bottom-0 rounded-t-3xl bg-surface ${tall ? '' : 'max-h-[90%]'}`}
          style={tall ? { top: 56 + insets.top } : undefined}>
          <View className="px-5 pt-2.5">
            <View className="h-1 w-10 self-center rounded-sm bg-line-input" />
            <View className="mb-1 mt-2.5 flex-row items-center">
              <ThemedText type="none" accessibilityRole="header" className="flex-1 font-sans-extrabold text-[20px] leading-[26px]">
                {title}
              </ThemedText>
              <View className="-mr-2.5">
                <IconButton icon="close" accessibilityLabel="Close" onPress={onClose} />
              </View>
            </View>
          </View>
          <ScrollView
            className={tall ? 'flex-1' : undefined}
            contentContainerClassName="gap-5 px-5 pb-4 pt-1"
            keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? (
            <View className="flex-row gap-2.5 border-t border-divider px-5 pt-3" style={{ paddingBottom: 20 + insets.bottom }}>
              {footer}
            </View>
          ) : (
            <View style={{ height: insets.bottom + 16 }} />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
