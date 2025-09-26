import React from 'react';
import {
  Platform,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Text,
} from 'react-native';
import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';
import { Colors } from '../constants/theme';
import { useColorScheme } from '../hooks/use-color-scheme';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { TabParamList } from '../navigation/RootNavigator';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = BottomTabScreenProps<TabParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <ThemedView style={styles.header}>
          <ThemedText type="title">Welcome!</ThemedText>
          <ThemedText style={styles.wave}>👋</ThemedText>
        </ThemedView>

        <ThemedView style={styles.content}>
          <ThemedView style={styles.stepContainer}>
            <ThemedText type="subtitle">Step 1: Try it</ThemedText>
            <ThemedText>
              Edit{' '}
              <ThemedText type="defaultSemiBold">
                src/screens/HomeScreen.tsx
              </ThemedText>{' '}
              to see changes. Press{' '}
              <ThemedText type="defaultSemiBold">
                {Platform.select({
                  ios: 'cmd + d',
                  android: 'cmd + m',
                  web: 'F12',
                })}
              </ThemedText>{' '}
              to open developer tools.
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.stepContainer}>
            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: Colors[colorScheme ?? 'light'].tint },
              ]}
              onPress={() => navigation.getParent()?.navigate('Modal')}
            >
              <Text style={styles.buttonText}>Step 2: Explore</Text>
            </TouchableOpacity>
            <ThemedText>{`Tap the Explore tab to learn more about what's included in this starter app.`}</ThemedText>
          </ThemedView>

          <ThemedView style={styles.stepContainer}>
            <ThemedText type="subtitle">Step 3: Get a fresh start</ThemedText>
            <ThemedText>
              {`When you're ready, you can customize this app with your own content and features.`}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.stepContainer}>
            <ThemedText type="subtitle">Navigation Examples</ThemedText>
            <TouchableOpacity
              style={[
                styles.navButton,
                { backgroundColor: Colors[colorScheme ?? 'light'].tint },
              ]}
              onPress={() =>
                navigation.getParent()?.navigate('User', { id: '1' })
              }
            >
              <Text style={styles.buttonText}>View User Details</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.navButton,
                { backgroundColor: Colors[colorScheme ?? 'light'].tint },
              ]}
              onPress={() =>
                navigation.getParent()?.navigate('UserPosts', { id: '1' })
              }
            >
              <Text style={styles.buttonText}>View User Posts</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.navButton,
                { backgroundColor: Colors[colorScheme ?? 'light'].tint },
              ]}
              onPress={() =>
                navigation.getParent()?.navigate('Post', { id: '1' })
              }
            >
              <Text style={styles.buttonText}>View Post Details</Text>
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 20,
    paddingBottom: 10,
  },
  wave: {
    fontSize: 24,
  },
  content: {
    padding: 20,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 20,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  navButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
});
