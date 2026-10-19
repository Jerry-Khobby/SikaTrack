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

/** A large round illustration with one icon in the middle. */
export function IconCircle({ icon, tone = 'blue', size = 132 }: IconCircleProps) {
  const theme = useTheme();
  const colors = {
    blue: { background: theme.tintBlue, icon: theme.iconBlue },
    neutral: { background: theme.tintNeutral, icon: theme.textSecondary },
    gold: { background: BrandColors.gold, icon: BrandColors.ink },
  }[tone];

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Icon
        name={icon}
        color={colors.icon}
        size={Math.round(size * 0.45)}
        strokeWidth={tone === 'gold' ? 2.2 : 1.8}
      />
    </View>
  );
}
