import { Text, type TextProps } from 'react-native';

export type TextLinkProps = TextProps & {
  onPress: () => void;
  bold?: boolean;
};

/** A link inside a sentence. Nest it in a ThemedText so it takes the sentence's size. */
export function TextLink({ bold, className, ...rest }: TextLinkProps) {
  return (
    <Text
      accessibilityRole="link"
      className={`text-link ${bold ? 'font-sans-bold' : 'font-sans-semibold'} ${className ?? ''}`}
      {...rest}
    />
  );
}
