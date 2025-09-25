import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';
import { Colors } from '../constants/theme';
import { useColorScheme } from '../hooks/use-color-scheme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'UserPosts'>;

interface Post {
  id: number;
  title: string;
  body: string;
  userId: number;
}

interface User {
  id: number;
  name: string;
  username: string;
  email: string;
}

export default function UserPostsScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const [posts, setPosts] = useState<Post[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (id) {
      fetchUserPosts();
      fetchUser();
    }
  }, [id]);

  const fetchUserPosts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `https://jsonplaceholder.typicode.com/posts?userId=${id}`,
      );
      if (!response.ok) {
        throw new Error('Failed to fetch user posts');
      }
      const data = await response.json();
      setPosts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchUser = async () => {
    try {
      const response = await fetch(
        `https://jsonplaceholder.typicode.com/users/${id}`,
      );
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch (err) {
      console.log('Failed to fetch user details');
    }
  };

  const renderPost = ({ item }: { item: Post }) => (
    <TouchableOpacity
      style={[
        styles.postCard,
        { backgroundColor: Colors[colorScheme ?? 'light'].background },
      ]}
      onPress={() => navigation.navigate('Post', { id: item.id.toString() })}
    >
      <ThemedText style={styles.postTitle}>{item.title}</ThemedText>
      <ThemedText style={styles.postBody}>{item.body}</ThemedText>
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
            onPress={fetchUserPosts}
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
        {user && (
          <View style={styles.userInfo}>
            <ThemedText type="title">{user.name}</ThemedText>
            <ThemedText style={styles.userDetails}>
              @{user.username} • {user.email}
            </ThemedText>
            <ThemedText style={styles.postCount}>
              {posts.length} posts
            </ThemedText>
          </View>
        )}
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
  userInfo: {
    marginBottom: 10,
  },
  userDetails: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 5,
  },
  postCount: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 5,
    fontStyle: 'italic',
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
    opacity: 0.8,
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
