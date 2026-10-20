import { ThemedText } from '@/components/atoms';
import { InfoCard, type InfoCardProps } from '@/components/molecules';
import { DetailTemplate } from '@/components/templates';
import { useAppConfig } from '@/hooks/use-app-config';
import { useGoBack } from '@/hooks/use-go-back';
import { joinWithAnd } from '@/utils/text';

const SECTIONS: InfoCardProps[] = [
  {
    icon: 'shield',
    title: 'Where it goes',
    body: "To SikaTrack's servers, in a private store. It's used only to build your transactions.",
  },
  {
    icon: 'user',
    title: 'Who can see it',
    body: 'Only you, along with the names and categories you choose for your payments.',
  },
  {
    icon: 'phone-off',
    title: 'What we never show',
    body: "Other people's phone numbers. People you pay appear by name only.",
  },
  {
    icon: 'log-out',
    title: 'How to leave',
    body: 'Delete your account from More. You get 7 days to change your mind, then everything is erased for good.',
  },
];

/** S35 · How we handle your data. Reachable before sign-in. */
export default function PrivacyScreen() {
  const goBack = useGoBack('/welcome');
  const config = useAppConfig();
  const senders = config ? joinWithAnd(config.momoSenders) : 'your mobile-money providers';

  return (
    <DetailTemplate title="How we handle your data" onBack={goBack}>
      <ThemedText type="bodySmall" themeColor="textSecondary" className="mb-1">
        The short version: we read your MoMo messages, nothing else, and only you see what we build
        from them.
      </ThemedText>
      <InfoCard
        icon="message"
        title="What we read"
        body={`Only SMS from ${senders}. Every other message stays on your phone and is never uploaded.`}
      />
      {SECTIONS.map((section) => (
        <InfoCard key={section.title} {...section} />
      ))}
    </DetailTemplate>
  );
}

