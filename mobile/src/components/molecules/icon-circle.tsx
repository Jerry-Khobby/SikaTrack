import { View } from 'react-native';

import { Icon, type IconName } from '@/components/atoms';
import { BrandColors } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type IconCircleProps = {
  icon: IconName;
  /** `blue` for information, `neutral` for a blocked step, `gold` for success on brand ink. */
  tone?: 'blue' | 'neutral' | 'gold';
  size?: number;
};

const TONE_CLASSES = {
  blue: 'bg-tint-blue',
  neutral: 'bg-tint-neutral',
  gold: 'bg-brand-gold',
} as const;

/** A large round illustration with one icon in the middle. */
export function IconCircle({ icon, tone = 'blue', size = 132 }: IconCircleProps) {
  const theme = useTheme();
  const iconColor = { blue: theme.iconBlue, neutral: theme.textSecondary, gold: BrandColors.ink }[tone];

  return (
    <View
      className={`items-center justify-center ${TONE_CLASSES[tone]}`}
      style={{ width: size, height: size, borderRadius: size / 2 }}>
      <Icon name={icon} color={iconColor} size={Math.round(size * 0.45)} strokeWidth={tone === 'gold' ? 2.2 : 1.8} />
    </View>
  );
}
