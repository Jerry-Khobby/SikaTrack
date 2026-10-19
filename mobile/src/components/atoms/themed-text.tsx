import { StyleSheet, Text, type TextProps } from 'react-native';

import { FontFamily, ThemeColor } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
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
    | 'fine';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'body', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return <Text style={[{ color: theme[themeColor ?? 'text'] }, styles[type], style]} {...rest} />;
}

const styles = StyleSheet.create({
  display: {
    fontFamily: FontFamily.extraBold,
    fontSize: 40,
    lineHeight: 43,
    letterSpacing: -1,
  },
  title: {
    fontFamily: FontFamily.extraBold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  headline: {
    fontFamily: FontFamily.extraBold,
    fontSize: 26,
    lineHeight: 32,
  },
  heading: {
    fontFamily: FontFamily.bold,
    fontSize: 20,
    lineHeight: 26,
  },
  subheading: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    lineHeight: 22,
  },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: 16,
    lineHeight: 23,
  },
  bodySmall: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 23,
  },
  callout: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 22,
  },
  caption: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  label: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    lineHeight: 18,
  },
  overline: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  fine: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    lineHeight: 18,
  },
});
