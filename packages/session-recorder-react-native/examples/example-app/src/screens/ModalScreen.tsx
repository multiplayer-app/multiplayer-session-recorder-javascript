import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';
import { Colors } from '../constants/theme';
import { useColorScheme } from '../hooks/use-color-scheme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Modal'>;

export default function ModalScreen({ navigation }: Props) {
  const colorScheme = useColorScheme();

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">This is a modal</ThemedText>
      <TouchableOpacity
        style={[
          styles.link,
          { backgroundColor: Colors[colorScheme ?? 'light'].tint },
        ]}
        onPress={() => navigation.goBack()}
        accessibilityLabel="Return to home screen"
        accessibilityRole="button"
        testID="home-screen-link"
      >
        <ThemedText style={styles.linkText}>Go back</ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  linkText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
