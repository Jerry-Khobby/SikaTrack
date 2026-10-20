import { View } from 'react-native';

import { Icon, type IconName } from '@/components/atoms';
import { useTheme } from '@/hooks/use-theme';

export type IconTone = 'blue' | 'orange' | 'green';

export type IconTileProps = {
  icon: IconName;
  tone?: IconTone;
  size?: number;
};

const TONE_CLASSES: Record<IconTone, string> = {
  blue: 'bg-tint-blue',
  orange: 'bg-tint-orange',
  green: 'bg-tint-green',
};

const ICON_COLORS = { blue: 'iconBlue', orange: 'iconOrange', green: 'iconGreen' } as const;

/** An icon on a soft tinted square. */
export function IconTile({ icon, tone = 'blue', size = 44 }: IconTileProps) {
  const theme = useTheme();

  return (
    <View
      className={`items-center justify-center ${TONE_CLASSES[tone]}`}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.31) }}>
      <Icon name={icon} color={theme[ICON_COLORS[tone]]} size={Math.round(size / 2)} />
    </View>
  );
}
