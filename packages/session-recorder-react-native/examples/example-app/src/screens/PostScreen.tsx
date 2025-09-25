import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  Switch,
} from 'react-native';

import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';
import { Colors } from '../constants/theme';
import { useColorScheme } from '../hooks/use-color-scheme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Post'>;

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

export default function PostScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const [post, setPost] = useState<Post | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedPost, setEditedPost] = useState<Post | null>(null);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (id) {
      fetchPost();
    }
  }, [id]);

  const fetchPost = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `https://jsonplaceholder.typicode.com/posts/${id}`,
      );
      if (!response.ok) {
        throw new Error('Failed to fetch post');
      }
      const data = await response.json();
      setPost(data);
      setEditedPost(data);

      // Fetch user details
      const userResponse = await fetch(
        `https://jsonplaceholder.typicode.com/users/${data.userId}`,
      );
      if (userResponse.ok) {
        const userData = await userResponse.json();
        setUser(userData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const updatePost = async () => {
    if (!editedPost) return;

    try {
      setUpdating(true);
      const response = await fetch(
        `https://jsonplaceholder.typicode.com/posts/${id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(editedPost),
        },
      );

      if (!response.ok) {
        throw new Error('Failed to update post');
      }

      const updatedData = await response.json();
      setPost(updatedData);
      setIsEditMode(false);
    } catch (err) {
      // Error occurred during update
    } finally {
      setUpdating(false);
    }
  };

  const deletePost = async () => {
    try {
      setDeleting(true);
      const response = await fetch(
        `https://jsonplaceholder.typicode.com/posts/${id}`,
        {
          method: 'DELETE',
        },
      );

      if (!response.ok) {
        throw new Error('Failed to delete post');
      }

      navigation.goBack();
    } catch (err) {
      // Error occurred during delete
    } finally {
      setDeleting(false);
    }
  };

  const handleEditToggle = () => {
    if (isEditMode) {
      // Cancel edit mode - reset to original post data
      setEditedPost(post);
    }
    setIsEditMode(prev => !prev);
  };

  const handleFieldChange = (field: string, value: string) => {
    if (!editedPost) return;
    setEditedPost({
      ...editedPost,
      [field]: value,
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ThemedView style={styles.centerContainer}>
          <ActivityIndicator
            size="large"
            color={Colors[colorScheme ?? 'light'].tint}
          />
          <ThemedText style={styles.loadingText}>Loading post...</ThemedText>
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
            onPress={fetchPost}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </ThemedView>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.container}>
        <ThemedView style={styles.centerContainer}>
          <ThemedText style={styles.errorText}>Post not found</ThemedText>
        </ThemedView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ThemedView style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.editToggle}>
            <ThemedText style={styles.editLabel}>Edit Mode</ThemedText>
            <Switch
              value={isEditMode}
              onValueChange={handleEditToggle}
              trackColor={{
                false: '#767577',
                true: Colors[colorScheme ?? 'light'].tint,
              }}
              thumbColor={isEditMode ? '#f4f3f4' : '#f4f3f4'}
            />
          </View>
        </View>
      </ThemedView>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <ThemedView style={styles.postCard}>
          {user && (
            <View style={styles.userInfo}>
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: Colors[colorScheme ?? 'light'].tint },
                ]}
              >
                <Text style={styles.avatarText}>
                  {user.name
                    .split(' ')
                    .map(n => n[0])
                    .join('')}
                </Text>
              </View>
              <View style={styles.userDetails}>
                <ThemedText style={styles.userName}>{user.name}</ThemedText>
                <ThemedText style={styles.userEmail}>
                  @{user.username}
                </ThemedText>
              </View>
            </View>
          )}

          <View style={styles.postContent}>
            <ThemedText style={styles.sectionTitle}>Title</ThemedText>
            {isEditMode ? (
              <TextInput
                style={[
                  styles.textInput,
                  { color: Colors[colorScheme ?? 'light'].text },
                ]}
                value={editedPost?.title || ''}
                onChangeText={value => handleFieldChange('title', value)}
                placeholder="Post Title"
                multiline
              />
            ) : (
              <ThemedText style={styles.postTitle}>{post.title}</ThemedText>
            )}

            <ThemedText style={styles.sectionTitle}>Content</ThemedText>
            {isEditMode ? (
              <TextInput
                style={[
                  styles.textInput,
                  styles.bodyInput,
                  { color: Colors[colorScheme ?? 'light'].text },
                ]}
                value={editedPost?.body || ''}
                onChangeText={value => handleFieldChange('body', value)}
                placeholder="Post Content"
                multiline
                numberOfLines={6}
              />
            ) : (
              <ThemedText style={styles.postBody}>{post.body}</ThemedText>
            )}
          </View>

          {isEditMode ? (
            <View style={styles.editButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={handleEditToggle}
                disabled={updating}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { backgroundColor: Colors[colorScheme ?? 'light'].tint },
                ]}
                onPress={updatePost}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.actionButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={deletePost}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.actionButtonText}>Delete Post</Text>
              )}
            </TouchableOpacity>
          )}
        </ThemedView>
      </ScrollView>
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  editToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  postCard: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    opacity: 0.7,
  },
  postContent: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    marginTop: 15,
    opacity: 0.8,
  },
  postTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    lineHeight: 28,
  },
  postBody: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.8,
  },
  textInput: {
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginBottom: 15,
  },
  bodyInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  editButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    flex: 1,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelButton: {
    backgroundColor: '#6c757d',
  },
  cancelButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  deleteButton: {
    backgroundColor: '#dc3545',
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
