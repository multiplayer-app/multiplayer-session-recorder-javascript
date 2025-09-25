import React from 'react';
import { Platform, StyleSheet, ScrollView } from 'react-native';
import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';
import { Colors } from '../constants/theme';
import { useColorScheme } from '../hooks/use-color-scheme';

export default function ExploreScreen() {
  const colorScheme = useColorScheme();

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Explore</ThemedText>
      </ThemedView>

      <ThemedView style={styles.content}>
        <ThemedText>
          This app includes example code to help you get started.
        </ThemedText>

        <ThemedView
          style={[
            styles.section,
            { backgroundColor: Colors[colorScheme ?? 'light'].background },
          ]}
        >
          <ThemedText type="subtitle">File-based routing</ThemedText>
          <ThemedText>
            This app has multiple screens with tab navigation and stack
            navigation. The layout file sets up the tab navigator with Home,
            Explore, Posts, and Users tabs.
          </ThemedText>
        </ThemedView>

        <ThemedView
          style={[
            styles.section,
            { backgroundColor: Colors[colorScheme ?? 'light'].background },
          ]}
        >
          <ThemedText type="subtitle">Android, iOS, and web support</ThemedText>
          <ThemedText>
            You can open this project on Android, iOS, and the web. To open the
            web version, press <ThemedText type="defaultSemiBold">w</ThemedText>{' '}
            in the terminal running this project.
          </ThemedText>
        </ThemedView>

        <ThemedView
          style={[
            styles.section,
            { backgroundColor: Colors[colorScheme ?? 'light'].background },
          ]}
        >
          <ThemedText type="subtitle">Images</ThemedText>
          <ThemedText>
            For static images, you can use the{' '}
            <ThemedText type="defaultSemiBold">@2x</ThemedText> and{' '}
            <ThemedText type="defaultSemiBold">@3x</ThemedText> suffixes to
            provide files for different screen densities
          </ThemedText>
        </ThemedView>

        <ThemedView
          style={[
            styles.section,
            { backgroundColor: Colors[colorScheme ?? 'light'].background },
          ]}
        >
          <ThemedText type="subtitle">
            Light and dark mode components
          </ThemedText>
          <ThemedText>
            This template has light and dark mode support. The{' '}
            <ThemedText type="defaultSemiBold">useColorScheme()</ThemedText>{' '}
            hook lets you inspect what the user's current color scheme is, and
            so you can adjust UI colors accordingly.
          </ThemedText>
        </ThemedView>

        <ThemedView
          style={[
            styles.section,
            { backgroundColor: Colors[colorScheme ?? 'light'].background },
          ]}
        >
          <ThemedText type="subtitle">Animations</ThemedText>
          <ThemedText>
            This template includes examples of animated components and smooth
            transitions between screens using React Navigation.
          </ThemedText>
          {Platform.select({
            ios: (
              <ThemedText>
                The navigation provides smooth transitions and native iOS feel.
              </ThemedText>
            ),
          })}
        </ThemedView>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
});
