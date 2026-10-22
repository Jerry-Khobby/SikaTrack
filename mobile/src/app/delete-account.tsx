import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Icon, ThemedText } from '@/components/atoms';
import { NumberedStep, TextField } from '@/components/molecules';
import { DetailTemplate } from '@/components/templates';
import { clearSession } from '@/api/session';
import { useGoBack } from '@/hooks/use-go-back';
import { useTheme } from '@/hooks/use-theme';
import { useDeleteAccount } from '@/hooks/queries';

const CONFIRM_WORD = 'DELETE';

/** S37 · Delete account: what happens, a typed confirmation, then the deletion is scheduled. */
export default function DeleteAccountScreen() {
  const router = useRouter();
  const goBack = useGoBack('/more');
  const theme = useTheme();
  const client = useQueryClient();
  const remove = useDeleteAccount();
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string>();
  const ready = typed.trim().toUpperCase() === CONFIRM_WORD;

  const confirm = async () => {
    setError(undefined);
    try {
      const until = await remove.mutateAsync();
      // Signed out on every phone: nothing of the account stays on this one.
      clearSession();
      client.clear();
      router.replace({ pathname: '/account-deleted', params: { until } });
    } catch {
      setError("We couldn't delete your account. Nothing has changed; try again.");
    }
  };

  return (
    <DetailTemplate
      onBack={goBack}
      footer={
        <>
          <Button variant="danger" label="Delete my account" onPress={confirm} disabled={!ready} loading={remove.isPending} />
          <Button variant="link" label="Cancel" onPress={goBack} />
        </>
      }>
      <View className="h-16 w-16 items-center justify-center rounded-[32px] bg-tint-red">
        <Icon name="alert" color={theme.iconRed} size={30} />
      </View>
      <ThemedText type="none" accessibilityRole="header" className="mb-1 mt-2 font-sans-extrabold text-[28px] leading-[34px] tracking-[-0.5px]">
        Delete your account?
      </ThemedText>
      <View className="gap-[14px]">
        <NumberedStep number={1} text="You're signed out on every phone straight away, and your data is hidden." />
        <NumberedStep number={2} text="After 7 days everything is deleted for good: your SMS, transactions and settings." />
        <NumberedStep number={3} text="Changed your mind? Sign in again within 7 days and nothing is lost." />
      </View>
      <View className="mt-5">
        <TextField
          label={`Type ${CONFIRM_WORD} to confirm`}
          value={typed}
          onChangeText={setTyped}
          placeholder={CONFIRM_WORD}
          autoCapitalize="characters"
          autoCorrect={false}
          error={error}
        />
      </View>
    </DetailTemplate>
  );
}
