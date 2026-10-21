import { useRouter } from 'expo-router';

import { ThemedText, TextLink } from '@/components/atoms';
import { InfoCard, type InfoCardProps } from '@/components/molecules';
import { DetailTemplate } from '@/components/templates';
import { useGoBack } from '@/hooks/use-go-back';

/**
 * The terms in plain language, linked from S04 ("By continuing you agree to
 * the Terms…"). A first draft of what the app does and doesn't promise; the
 * legal wording still needs a lawyer's review before release.
 */
const SECTIONS: InfoCardProps[] = [
  {
    icon: 'pie-chart',
    title: 'What SikaTrack is',
    body: 'An app that reads your mobile-money SMS and shows where your money goes. It is not a bank or a wallet, and it can never move money.',
  },
  {
    icon: 'alert',
    title: 'Figures come from your SMS',
    body: "Everything is worked out from your provider's messages. If an SMS is late, missing or unclear, a figure can be off; your provider's statement is the official record.",
  },
  {
    icon: 'user',
    title: 'Your account',
    body: 'One account per phone number. Keep your phone locked: anyone who can open the app on it can see your spending.',
  },
  {
    icon: 'shield',
    title: 'Your data',
    body: "It's yours. We use it only to build your transactions and alerts, and we never sell it. How we handle it is set out in the privacy page.",
  },
  {
    icon: 'log-out',
    title: 'Leaving',
    body: 'Delete your account from More at any time. You get 7 days to change your mind, then everything is erased for good.',
  },
  {
    icon: 'bell',
    title: 'Changes',
    body: 'If these terms change, we tell you in the app before the new ones apply.',
  },
];

/** Terms of use, reachable before sign-in. */
export default function TermsScreen() {
  const router = useRouter();
  const goBack = useGoBack('/welcome');

  return (
    <DetailTemplate title="Terms of use" onBack={goBack}>
      <ThemedText type="bodySmall" themeColor="textSecondary" className="mb-1">
        The short version: SikaTrack shows you your money; it never touches it.
      </ThemedText>
      {SECTIONS.map((section) => (
        <InfoCard key={section.title} {...section} />
      ))}
      <ThemedText type="bodySmall" className="mt-1 text-center">
        <TextLink bold onPress={() => router.push('/privacy')}>
          How we handle your data
        </TextLink>
      </ThemedText>
    </DetailTemplate>
  );
}
