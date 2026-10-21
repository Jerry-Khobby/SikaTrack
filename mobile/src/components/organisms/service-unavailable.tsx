import { Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Icon, ThemedText } from '@/components/atoms';
import { useTheme } from '@/hooks/use-theme';

export type ServiceUnavailableProps = {
  retrying: boolean;
  onRetry: () => void;
  /** Back to the screens that loaded before, which stay usable. */
  onDismiss: () => void;
};

/** G5: the servers can't be reached and this screen has nothing saved to show. */
export function ServiceUnavailable({ retrying, onRetry, onDismiss }: ServiceUnavailableProps) {
  const theme = useTheme();

  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>
      <SafeAreaView className="flex-1 bg-background px-6">
        <View accessibilityRole="alert" className="flex-1 items-center justify-center gap-[18px]">
          <View className="h-28 w-28 items-center justify-center rounded-[56px] bg-tint-neutral">
            <Icon name="cloud-off" color={theme.textBody} size={48} />
          </View>
          <ThemedText type="none" accessibilityRole="header" className="text-center font-sans-extrabold text-[24px] leading-[30px]">
            SikaTrack is taking a break
          </ThemedText>
          <ThemedText type="body" themeColor="textSecondary" className="max-w-[300px] text-center">
            We can't reach our servers right now. Your saved data is still here, and new SMS will upload when we're back.
          </ThemedText>
        </View>
        <View className="gap-1.5 pb-6">
          <Button label="Try again" onPress={onRetry} loading={retrying} />
          <Pressable accessibilityRole="button" onPress={onDismiss} className="h-11 items-center justify-center">
            <Text className="font-sans-bold text-[15px] text-content">Keep using saved data</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
