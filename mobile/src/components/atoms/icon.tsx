import type { ReactNode } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

const paths = {
  'chevron-left': <Path d="M15 18l-6-6 6-6" />,
  'chevron-down': <Path d="M6 9l6 6 6-6" />,
  check: <Path d="M5 12l5 5 9-10" />,
  close: <Path d="M6 6l12 12M18 6L6 18" />,
  search: (
    <>
      <Circle cx={11} cy={11} r={7} />
      <Path d="M20 20l-3.5-3.5" />
    </>
  ),
  globe: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M3 12h18" />
      <Path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z" />
    </>
  ),
  'pie-chart': (
    <>
      <Path d="M21 12A9 9 0 1 1 12 3v9z" />
      <Path d="M15 3.5A9 9 0 0 1 20.5 9H15z" />
    </>
  ),
  repeat: (
    <>
      <Path d="M17 2l4 4-4 4" />
      <Path d="M3 11V9a3 3 0 0 1 3-3h15" />
      <Path d="M7 22l-4-4 4-4" />
      <Path d="M21 13v2a3 3 0 0 1-3 3H3" />
    </>
  ),
  target: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Circle cx={12} cy={12} r={5} />
      <Circle cx={12} cy={12} r={1} />
    </>
  ),
  'phone-update': (
    <>
      <Rect x={6} y={2} width={12} height={20} rx={2.5} />
      <Path d="M12 7v7M9 11l3 3 3-3" />
      <Path d="M11 18.5h2" />
    </>
  ),
  'phone-off': (
    <>
      <Rect x={7} y={2} width={10} height={20} rx={2} />
      <Path d="M4 4l16 16" />
    </>
  ),
  message: <Path d="M4 4h16v12H8l-4 4z" />,
  shield: <Path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />,
  user: (
    <>
      <Circle cx={12} cy={8} r={4} />
      <Path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  'log-out': (
    <>
      <Path d="M9 4H5v16h4" />
      <Path d="M15 8l4 4-4 4M19 12H9" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof paths;

export type IconProps = {
  name: IconName;
  color: string;
  size?: number;
};

/** Line icons drawn on a 24×24 grid. */
export function Icon({ name, color, size = 24 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round">
      {paths[name]}
    </Svg>
  );
}
