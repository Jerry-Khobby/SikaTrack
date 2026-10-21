import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { Button, ProviderBadge, ThemedText } from '@/components/atoms';
import { BulletPoint } from '@/components/molecules';
import { DetailTemplate } from '@/components/templates';
import { useAppConfig } from '@/hooks/use-app-config';
import { useGoBack } from '@/hooks/use-go-back';
import { joinWithAnd } from '@/utils/text';

/**
 * A provider the server lists as not supported yet (`supported: false` in
 * `GET /v1/config`), e.g. Telecel Cash: what that means and what still works.
 */
export default function ProviderComingSoonScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const goBack = useGoBack('/onboarding/wallets');
  const config = useAppConfig();
  const provider = config?.providers.find((p) => p.code === code);
  const name = provider?.name ?? 'This provider';
  const supported = (config?.providers ?? []).filter((p) => p.supported).map((p) => p.name);
  const others = supported.length ? joinWithAnd(supported) : 'the supported providers';

  return (
    <DetailTemplate onBack={goBack} footer={<Button label="Back to wallets" onPress={goBack} />}>
      <View className="items-center pb-2 pt-1">
        <ProviderBadge code={code} name={name} size={64} muted />
        <ThemedText type="none" accessibilityRole="header" className="mt-4 text-center font-sans-extrabold text-[24px] leading-[30px]">
          {name} is coming soon
        </ThemedText>
        <ThemedText type="bodySmall" themeColor="textSecondary" className="mt-2 text-center">
          SikaTrack can't read {name} SMS yet, so payments from a {name} wallet won't show up for now.
        </ThemedText>
      </View>
      <View className="gap-[14px] rounded-[20px] bg-surface p-4">
        <BulletPoint icon="check" text={`Add your ${others} wallets now. They work fully today.`} />
        <BulletPoint
          icon="check"
          text={`Money you send from those wallets to a ${name} number still shows up, as a payment to that person.`}
        />
        <BulletPoint icon="check" text={`When ${name} is ready it appears under Add a wallet. There's nothing to sign up for.`} />
      </View>
    </DetailTemplate>
  );
}
