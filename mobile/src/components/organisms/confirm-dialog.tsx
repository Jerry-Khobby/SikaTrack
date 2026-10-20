import { Modal, Pressable, Text, View } from 'react-native';

import { ThemedText } from '@/components/atoms';

export type ConfirmDialogProps = {
  title: string;
  message: string;
  confirmLabel: string;
  /** Red confirm button, for removing or signing out. */
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** A short question in the middle of the screen with Cancel and one action. Mount it to show it. */
export function ConfirmDialog({ title, message, confirmLabel, destructive, busy, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center px-8">
        <Pressable accessibilityLabel="Cancel" onPress={onCancel} className="absolute inset-0 bg-overlay" />
        <View accessibilityViewIsModal className="w-full max-w-[360px] rounded-[22px] bg-surface p-5">
          <ThemedText type="none" accessibilityRole="header" className="font-sans-extrabold text-[18px] leading-[24px]">
            {title}
          </ThemedText>
          <ThemedText type="bodySmall" themeColor="textSecondary" className="mt-2">
            {message}
          </ThemedText>
          <View className="mt-5 flex-row justify-end gap-2">
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              className="h-11 justify-center rounded-sm px-4 active:bg-chip">
              <Text className="font-sans-bold text-[15px] text-content">Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={onConfirm}
              className={`h-11 justify-center rounded-sm px-4 ${destructive ? 'bg-status-bad' : 'bg-primary'} ${
                busy ? 'opacity-60' : 'active:opacity-90'
              }`}>
              <Text className={`font-sans-bold text-[15px] ${destructive ? 'text-white' : 'text-on-primary'}`}>
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
