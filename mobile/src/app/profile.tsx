import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Card, Icon, ThemedText } from '@/components/atoms';
import { IconTile, TextField } from '@/components/molecules';
import { DetailTemplate } from '@/components/templates';
import { useGoBack } from '@/hooks/use-go-back';
import { useMe } from '@/hooks/use-me';
import { useTheme } from '@/hooks/use-theme';
import { useUpdateMe } from '@/hooks/queries';
import { formatFullDate } from '@/utils/dates';
import { formatCount, formatShortMonth } from '@/utils/format';
import { formatPhoneNumber } from '@/utils/phone';

/** S33 · Profile: the name SikaTrack calls you, your number, and what it holds for you. */
export default function ProfileScreen() {
  const goBack = useGoBack('/more');
  const theme = useTheme();
  const me = useMe();
  const update = useUpdateMe();
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (me) setName(me.displayName ?? '');
  }, [me]);

  const trimmed = name.trim();
  const changed = me !== undefined && trimmed !== (me.displayName ?? '');

  const save = async () => {
    setError(undefined);
    try {
      await update.mutateAsync({ displayName: trimmed });
      goBack();
    } catch {
      setError("We couldn't save your name. Try again.");
    }
  };

  return (
    <DetailTemplate
      title="Profile"
      onBack={goBack}
      gutter="narrow"
      footer={<Button label="Save" onPress={save} disabled={!changed || !trimmed} loading={update.isPending} />}>
      <View className="items-center pb-4 pt-2">
        <View className="h-[84px] w-[84px] items-center justify-center rounded-[42px] bg-brand-gold">
          <Text className="font-sans-extrabold text-[36px] text-brand-ink">{(trimmed || 'Y').charAt(0).toUpperCase()}</Text>
        </View>
        {me && (
          <ThemedText type="caption" themeColor="textSecondary" className="mt-2.5">
            Member since {formatShortMonth(me.createdAt)}
          </ThemedText>
        )}
      </View>

      <Card>
        <TextField
          label="Display name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          returnKeyType="done"
          error={error}
          maxLength={40}
        />
        <ThemedText type="none" className="mt-[18px] font-sans-extrabold text-[13px] leading-[18px]">
          Phone number
        </ThemedText>
        <View
          accessible
          accessibilityLabel={`Phone number, ${me?.phoneNumber ? formatPhoneNumber(me.phoneNumber) : 'none'}. To change it, contact support.`}
          className="mt-2 h-[50px] flex-row items-center justify-between rounded-sm bg-chip px-[14px]">
          <Text className="font-sans-semibold text-[16px] text-content-body">
            {me?.phoneNumber ? formatPhoneNumber(me.phoneNumber) : '—'}
          </Text>
          <Icon name="lock" color={theme.textBody} size={18} />
        </View>
        <ThemedText type="fine" themeColor="textSecondary" className="mt-2">
          To change it, contact support.
        </ThemedText>
      </Card>

      {me && (
        <Card className="flex-row items-center gap-[14px]">
          <IconTile icon="list" size={44} />
          <View className="flex-1">
            <ThemedText type="none" className="font-sans-extrabold text-[16px] leading-[22px]">
              {formatCount(me.data.transactions)} transaction{me.data.transactions === 1 ? '' : 's'}
            </ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {me.data.firstTransactionAt && me.data.lastTransactionAt
                ? `from ${formatFullDate(me.data.firstTransactionAt)} to ${formatFullDate(me.data.lastTransactionAt)}`
                : 'None yet. They appear as your MoMo SMS arrive.'}
            </ThemedText>
          </View>
        </Card>
      )}
    </DetailTemplate>
  );
}
