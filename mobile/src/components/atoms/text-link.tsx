import { Text, type TextProps } from 'react-native';

import { FontFamily } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type TextLinkProps = TextProps & {
  onPress: () => void;
  bold?: boolean;
};

/** A link inside a sentence. Nest it in a ThemedText so it takes the sentence's size. */
export function TextLink({ style, bold, ...rest }: TextLinkProps) {
  const theme = useTheme();

  return (
    <Text
      accessibilityRole="link"
      style={[
        { color: theme.link, fontFamily: bold ? FontFamily.bold : FontFamily.semiBold },
        style,
      ]}
      {...rest}
    />
  );
}
