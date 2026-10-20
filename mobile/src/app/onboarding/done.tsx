import { useRouter } from 'expo-router';

import { Button, ThemedText } from '@/components/atoms';
import { IconCircle } from '@/components/molecules';
import { CelebrationTemplate } from '@/components/templates';
import { useInitialScan } from '@/hooks/use-initial-scan';
import { useMe } from '@/hooks/use-me';
import type { ScanState } from '@/services/sms';
import { formatCount, formatShortMonth } from '@/utils/format';

/** A one-line teaser from the first sync. */
function teaser(scan: ScanState) {
  if (scan.status !== 'done') {
    return "We're still reading your messages. They'll be on your dashboard soon.";
  }
  if (scan.parsed === 0) {
    return 'New MoMo messages will show up on your dashboard as they arrive.';
  }
  const since = scan.firstTransactionAt ? ` since ${formatShortMonth(scan.firstTransactionAt)}` : '';
  return `We found ${formatCount(scan.parsed)} transactions${since}.`;
}

/** S11 · All set */
export default function AllSetScreen() {
  const router = useRouter();
  const me = useMe();
  const scan = useInitialScan();

  const goHome = () => {
    if (router.canDismiss()) {
      router.dismissAll();
    }
    router.replace('/home');
  };

  return (
    <CelebrationTemplate action={<Button variant="accent" label="Go to my dashboard" onPress={goHome} />}>
      <IconCircle icon="check" tone="gold" size={120} />
      <ThemedText type="none" themeColor="none" accessibilityRole="header" className="text-center font-sans-extrabold text-[32px] leading-[38px] tracking-[-0.5px] text-brand-on-ink">
        {me?.displayName ? `You're all set, ${me.displayName}` : "You're all set"}
      </ThemedText>
      <ThemedText type="none" themeColor="none" className="max-w-[290px] text-center font-sans text-[16px] leading-[24px] text-brand-on-ink-soft">{teaser(scan)}</ThemedText>
    </CelebrationTemplate>
  );
}

