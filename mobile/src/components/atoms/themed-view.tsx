import { View, type ViewProps } from 'react-native';

/** A view on the page background colour. */
export function ThemedView({ className, ...rest }: ViewProps) {
  return <View className={`bg-background ${className ?? ''}`} {...rest} />;
}
