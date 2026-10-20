import { Text, type TextProps } from 'react-native';

export type TextType =
  | 'display'
  | 'title'
  | 'headline'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'bodySmall'
  | 'callout'
  | 'caption'
  | 'label'
  | 'overline'
  | 'fine'
  /** No type styles: the caller sets font, size and line height in `className`. */
  | 'none';

export type TextColor =
  | 'text'
  | 'textBody'
  | 'textSecondary'
  | 'textDisabled'
  | 'link'
  | 'error'
  | 'iconSuccess'
  /** No colour class: the caller sets the colour in `className`. */
  | 'none';

export type ThemedTextProps = TextProps & {
  type?: TextType;
  themeColor?: TextColor;
};

const TYPE_CLASSES: Record<TextType, string> = {
  display: 'font-sans-extrabold text-[40px] leading-[43px] tracking-[-1px]',
  title: 'font-sans-extrabold text-[28px] leading-[34px] tracking-[-0.5px]',
  headline: 'font-sans-extrabold text-[26px] leading-[32px]',
  heading: 'font-sans-bold text-[20px] leading-[26px]',
  subheading: 'font-sans-bold text-[16px] leading-[22px]',
  body: 'font-sans text-[16px] leading-[23px]',
  bodySmall: 'font-sans text-[15px] leading-[23px]',
  callout: 'font-sans text-[14px] leading-[22px]',
  caption: 'font-sans text-[13px] leading-[18px]',
  label: 'font-sans-bold text-[13px] leading-[18px]',
  overline: 'font-sans-bold text-[12px] leading-[16px] tracking-[0.6px] uppercase',
  fine: 'font-sans text-[12px] leading-[18px]',
  none: '',
};

const COLOR_CLASSES: Record<TextColor, string> = {
  text: 'text-content',
  textBody: 'text-content-body',
  textSecondary: 'text-content-secondary',
  textDisabled: 'text-content-disabled',
  link: 'text-link',
  error: 'text-error',
  iconSuccess: 'text-icon-success',
  none: '',
};

/**
 * Text in one of the app's type styles and theme colours. Extra `className`s
 * add layout (margins, alignment); for a different font or colour use
 * `type="none"` or a plain `Text`, so two classes never fight over one property.
 */
export function ThemedText({ type = 'body', themeColor = 'text', className, ...rest }: ThemedTextProps) {
  return <Text className={`${TYPE_CLASSES[type]} ${COLOR_CLASSES[themeColor]} ${className ?? ''}`} {...rest} />;
}
