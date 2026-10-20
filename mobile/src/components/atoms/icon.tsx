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
  'message-dash': (
    <>
      <Path d="M4 4h16v12H8l-4 4z" />
      <Path d="M9 10h6" />
    </>
  ),
  lock: (
    <>
      <Rect x={5} y={11} width={14} height={10} rx={2} />
      <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  edit: <Path d="M4 20h4L19 9l-4-4L4 16z" />,
  plus: <Path d="M12 5v14M5 12h14" />,
  download: <Path d="M12 3v12M7 10l5 5 5-5M4 21h16" />,
  trash: <Path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  home: <Path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  list: <Path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  dots: (
    <>
      <Circle cx={5} cy={12} r={1.2} />
      <Circle cx={12} cy={12} r={1.2} />
      <Circle cx={19} cy={12} r={1.2} />
    </>
  ),
  bell: (
    <>
      <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  ),
  sync: (
    <>
      <Path d="M20 11a8 8 0 0 0-14.5-4.5L4 8" />
      <Path d="M4 3v5h5" />
      <Path d="M4 13a8 8 0 0 0 14.5 4.5L20 16" />
      <Path d="M20 21v-5h-5" />
    </>
  ),
  'chevron-right': <Path d="M9 18l6-6-6-6" />,
  info: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 11v5M12 8h.01" />
    </>
  ),
  alert: (
    <>
      <Path d="M12 3 2 21h20z" />
      <Path d="M12 10v4M12 17.5h.01" />
    </>
  ),
  lightbulb: <Path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />,
  copy: (
    <>
      <Rect x={9} y={9} width={12} height={12} rx={2} />
      <Path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </>
  ),
  swap: (
    <>
      <Path d="M7 7h13M16 3l4 4-4 4" />
      <Path d="M17 17H4M8 13l-4 4 4 4" />
    </>
  ),
  sliders: (
    <>
      <Path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
      <Circle cx={16} cy={6} r={2} />
      <Circle cx={10} cy={12} r={2} />
      <Circle cx={18} cy={18} r={2} />
    </>
  ),
  calendar: (
    <>
      <Rect x={3} y={5} width={18} height={16} rx={2} />
      <Path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  wallet: (
    <>
      <Path d="M3 7a2 2 0 0 1 2-2h13v4" />
      <Path d="M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2" />
      <Circle cx={16} cy={14.5} r={1} />
    </>
  ),
  store: (
    <>
      <Path d="M4 9l1.5-5h13L20 9" />
      <Path d="M4 9v11h16V9" />
    </>
  ),
  cash: (
    <>
      <Rect x={2} y={6} width={20} height={12} rx={2} />
      <Circle cx={12} cy={12} r={2.5} />
    </>
  ),
  phone: (
    <>
      <Rect x={7} y={2} width={10} height={20} rx={2} />
      <Path d="M11 18h2" />
    </>
  ),
  bank: <Path d="M3 10l9-6 9 6M5 10v9M19 10v9M9 10v9M15 10v9M3 21h18" />,
  help: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17h.01" />
    </>
  ),
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
  strokeWidth?: number;
};

/** Line icons drawn on a 24×24 grid. */
export function Icon({ name, color, size = 24, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round">
      {paths[name]}
    </Svg>
  );
}
