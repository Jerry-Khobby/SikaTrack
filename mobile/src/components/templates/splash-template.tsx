import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

type SplashTemplateProps = {
  children: ReactNode;
  footer?: string;
};

/** Full-screen brand ink with the content centred and a small line at the bottom. */
export function SplashTemplate({ children, footer }: SplashTemplateProps) {
  return (
    <View className="flex-1 items-center justify-center bg-brand-ink">
      <StatusBar style="light" />
      {children}
      {footer && (
        <Text className="absolute bottom-12 font-sans text-[13px] leading-[18px] text-brand-on-ink-muted">{footer}</Text>
      )}
    </View>
  );
}
