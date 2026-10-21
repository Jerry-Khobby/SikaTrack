import { Modal, Pressable, Text, View } from 'react-native';

import { Button, Icon, ThemedText } from '@/components/atoms';
import { useTheme } from '@/hooks/use-theme';

export type SessionExpiredDialogProps = {
  /** E.g. `+233 24 123 4567`; without one, the dialog only offers to sign in. */
  phoneNumber: string | null;
  sending: boolean;
  error?: string;
  onSendCode: () => void;
  onUseAnotherNumber: () => void;
};

/**
 * G2: the session ended (refresh token expired, revoked or used elsewhere).
 * It can't be dismissed: the only ways on are signing in again.
 */
export function SessionExpiredDialog({ phoneNumber, sending, error, onSendCode, onUseAnotherNumber }: SessionExpiredDialogProps) {
  const theme = useTheme();

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => undefined}>
      <View className="flex-1 items-center justify-center bg-overlay px-6">
        <View accessibilityViewIsModal accessibilityRole="alert" className="w-full max-w-[380px] rounded-3xl bg-surface p-6">
          <View className="h-12 w-12 items-center justify-center rounded-3xl bg-tint-blue">
            <Icon name="lock" color={theme.iconBlue} size={24} />
          </View>
          <ThemedText type="none" accessibilityRole="header" className="mt-4 font-sans-extrabold text-[20px] leading-[26px]">
            Please sign in again
          </ThemedText>
          <ThemedText type="bodySmall" themeColor="textSecondary" className="mb-[22px] mt-2">
            {phoneNumber
              ? `For your security, you've been signed out. We'll text a new code to ${phoneNumber}.`
              : "For your security, you've been signed out."}
          </ThemedText>
          {error && (
            <ThemedText type="caption" themeColor="error" accessibilityLiveRegion="polite" className="mb-3">
              {error}
            </ThemedText>
          )}
          {phoneNumber ? (
            <Button label="Send code" onPress={onSendCode} loading={sending} />
          ) : (
            <Button label="Sign in" onPress={onUseAnotherNumber} />
          )}
          {phoneNumber && (
            <Pressable accessibilityRole="button" onPress={onUseAnotherNumber} className="mt-1.5 h-11 items-center justify-center">
              <Text className="font-sans-bold text-[14px] text-link">Use a different number</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}
