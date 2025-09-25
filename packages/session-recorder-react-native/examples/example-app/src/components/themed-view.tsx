import { View, type ViewProps } from 'react-native';
import { useColorScheme } from 'react-native';

export type ThemedViewProps = ViewProps & {
  darkColor?: string;
  lightColor?: string;
};

export function ThemedView({
  style,
  darkColor,
  lightColor,
  ...otherProps
}: ThemedViewProps) {
  const colorScheme = useColorScheme();
  const backgroundColor =
    colorScheme === 'dark' ? darkColor || '#000' : lightColor || '#fff';

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
