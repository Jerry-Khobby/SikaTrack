import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Card, Icon, Pill, ThemedText } from '@/components/atoms';
import { ErrorState, StatLine } from '@/components/molecules';
import { SyncStatusCard } from '@/components/organisms';
import { DetailTemplate } from '@/components/templates';
import { requestIdOf } from '@/api/query-client';
import { useGoBack } from '@/hooks/use-go-back';
import { useMe } from '@/hooks/use-me';
import { useTheme } from '@/hooks/use-theme';
import { queryKeys, useSyncStatus } from '@/hooks/queries';
import { hasSmsPermission } from '@/services/permissions';
import { syncNow, syncState, type SyncStatus } from '@/services/sync';
import { formatDateTime, formatTime } from '@/utils/dates';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The headline for each state (docs/ui-spec.md S34). */
function headline(status: SyncStatus) {
  switch (syncState(status)) {
    case 'delayed':
      return { title: 'Taking longer than usual', message: "The last run didn't finish. We retry automatically, and nothing is lost." };
    case 'processing':
      return status.pendingMessages > 0
        ? { title: `Processing ${plural(status.pendingMessages, 'message')}`, message: 'New SMS are being turned into payments. This usually takes a few minutes.' }
        : {
            title: `Processing ${plural(status.provisionalTransactions, 'payment')}`,
            message: 'Recent payments show a Processing tag until they are confirmed, usually within a few minutes.',
          };
    default:
      return { title: 'Up to date', message: 'Everything has been read and processed.' };
  }
}

const RUN_LABELS = { succeeded: 'OK', failed: 'Failed', running: 'Running' } as const;

/** S34 · Sync status: whether your latest SMS have made it into SikaTrack, and a way to nudge it. */
export default function SyncScreen() {
  const router = useRouter();
  const goBack = useGoBack('/more');
  const theme = useTheme();
  const client = useQueryClient();
  const me = useMe();
  const status = useSyncStatus();
  const [syncing, setSyncing] = useState(false);
  const [note, setNote] = useState<string>();

  const runSync = async () => {
    if (!status.data) return;
    setSyncing(true);
    setNote(undefined);
    try {
      if (!(await hasSmsPermission())) {
        setNote("SikaTrack can't read your SMS. Turn on SMS for SikaTrack in Android settings.");
        return;
      }
      const sent = await syncNow(status.data);
      await Promise.all([
        status.refetch(),
        client.invalidateQueries({ queryKey: queryKeys.transactions }),
        client.invalidateQueries({ queryKey: ['summary'] }),
      ]);
      setNote(
        sent > 0
          ? `Sent ${plural(sent, 'new message')}.`
          : status.data.dataThrough
            ? `No new MoMo SMS since ${formatTime(status.data.dataThrough)}.`
            : 'No new MoMo SMS.',
      );
    } catch {
      setNote("We couldn't sync just now. Try again in a moment.");
    } finally {
      setSyncing(false);
    }
  };

  if (status.isError) {
    return (
      <DetailTemplate title="Sync status" onBack={goBack} gutter="narrow">
        <ErrorState title="We couldn't check your sync" requestId={requestIdOf(status.error)} onRetry={() => status.refetch()} />
      </DetailTemplate>
    );
  }

  const s = status.data;
  const smsAllowed = me?.onboarding.smsPermission !== 'denied';

  return (
    <DetailTemplate
      title="Sync status"
      onBack={goBack}
      gutter="narrow"
      refreshing={status.isRefetching && !syncing}
      onRefresh={() => status.refetch()}
      footer={
        <>
          {note && (
            <ThemedText type="caption" themeColor="textSecondary" accessibilityLiveRegion="polite" className="text-center">
              {note}
            </ThemedText>
          )}
          <Button label="Sync now" onPress={runSync} loading={syncing} disabled={!s} />
        </>
      }>
      {!s ? (
        <>
          <View className="h-[110px] rounded-[22px] bg-skeleton" />
          <View className="h-[230px] rounded-[20px] bg-skeleton" />
        </>
      ) : (
        <>
          <SyncStatusCard state={syncState(s)} {...headline(s)} />
          <Card padded={false} className="px-4 py-1">
            <StatLine label="Last upload" value={s.lastUploadAt ? formatDateTime(s.lastUploadAt) : 'Not yet'} divider />
            <StatLine label="Messages waiting" value={String(s.pendingMessages)} divider />
            <StatLine label="Payments still processing" value={String(s.provisionalTransactions)} divider />
            <StatLine
              label="Last processing run"
              value={s.lastRun?.finishedAt ? `${formatDateTime(s.lastRun.finishedAt)} · ${RUN_LABELS[s.lastRun.status]}` : s.lastRun ? RUN_LABELS[s.lastRun.status] : 'Not yet'}
              divider
            />
            <StatLine label="Data up to" value={s.dataThrough ? formatDateTime(s.dataThrough) : 'No data yet'} />
          </Card>
        </>
      )}

      <Card className="flex-row items-center gap-3">
        <Icon name="message" color={theme.text} size={20} />
        <ThemedText type="none" className="flex-1 font-sans-bold text-[15px] leading-[21px]">
          SMS permission
        </ThemedText>
        {smsAllowed ? (
          <Pill label="Allowed" tone="green" />
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="SMS permission is off. Turn on" onPress={() => router.push('/onboarding/sms')} hitSlop={8}>
            <Text className="font-sans-bold text-[13px] text-link">Off · Turn on</Text>
          </Pressable>
        )}
      </Card>
    </DetailTemplate>
  );
}
