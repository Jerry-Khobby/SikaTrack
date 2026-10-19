import { View } from 'react-native';

import { Icon, type IconName } from '@/components/atoms';
import { useTheme } from '@/hooks/use-theme';

export type IconTone = 'blue' | 'orange' | 'green';

export type IconTileProps = {
  icon: IconName;
  tone?: IconTone;
  size?: number;
};

const toneColors = {
  blue: { background: 'tintBlue', icon: 'iconBlue' },
  orange: { background: 'tintOrange', icon: 'iconOrange' },
  green: { background: 'tintGreen', icon: 'iconGreen' },
} as const;

/** An icon on a soft tinted square. */
export function IconTile({ icon, tone = 'blue', size = 44 }: IconTileProps) {
  const theme = useTheme();
  const colors = toneColors[tone];

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.31),
        backgroundColor: theme[colors.background],
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Icon name={icon} color={theme[colors.icon]} size={Math.round(size / 2)} />
    </View>
  );
}
