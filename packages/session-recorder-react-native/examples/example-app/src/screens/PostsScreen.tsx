import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';

import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';
import { Colors } from '../constants/theme';
import { useColorScheme } from '../hooks/use-color-scheme';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { TabParamList } from '../navigation/RootNavigator';

type Props = BottomTabScreenProps<TabParamList, 'Posts'>;

interface Post {
  id: number;
  title: string;
  body: string;
  userId: number;
}

export default function PostsScreen({ navigation }: Props) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const colorScheme = useColorScheme();

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        'https://jsonplaceholder.typicode.com/posts',
      );
      if (!response.ok) {
        throw new Error('Failed to fetch posts');
      }
      const data = await response.json();
      setPosts(data.slice(0, 20)); // Limit to first 20 posts
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handlePostPress = (post: Post) => {
    navigation.getParent()?.navigate('Post', { id: post.id.toString() });
  };

  const renderPost = ({ item }: { item: Post }) => (
    <TouchableOpacity
      style={[
        styles.postCard,
        { backgroundColor: Colors[colorScheme ?? 'light'].background },
      ]}
      onPress={() => handlePostPress(item)}
      accessibilityLabel={`View post: ${item.title}`}
      accessibilityRole="button"
      testID={`post-card-${item.id}`}
    >
      <ThemedText style={styles.postTitle} numberOfLines={2}>
        {item.title}
      </ThemedText>
      <ThemedText style={styles.postBody} numberOfLines={3}>
        {item.body}
      </ThemedText>
      <ThemedText style={styles.postMeta}>
        User ID: {item.userId} • Post ID: {item.id}
      </ThemedText>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ThemedView style={styles.centerContainer}>
          <ActivityIndicator
            size="large"
            color={Colors[colorScheme ?? 'light'].tint}
          />
          <ThemedText style={styles.loadingText}>Loading posts...</ThemedText>
        </ThemedView>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <ThemedView style={styles.centerContainer}>
          <ThemedText style={styles.errorText}>Error: {error}</ThemedText>
          <TouchableOpacity
            style={[
              styles.retryButton,
              { backgroundColor: Colors[colorScheme ?? 'light'].tint },
            ]}
            onPress={fetchPosts}
            accessibilityLabel="Retry loading posts"
            accessibilityRole="button"
            testID="retry-posts-button"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </ThemedView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Posts</ThemedText>
        <ThemedText style={styles.subtitle}>
          Tap on a post to view details
        </ThemedText>
      </ThemedView>

      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 5,
  },
  listContainer: {
    padding: 20,
    paddingTop: 10,
  },
  postCard: {
    padding: 16,
    marginBottom: 12,
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
  postTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  postBody: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
    opacity: 0.8,
  },
  postMeta: {
    fontSize: 12,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});
