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
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { TabParamList } from '../navigation/RootNavigator';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = BottomTabScreenProps<TabParamList, 'Users'>;

interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  address: {
    street: string;
    suite: string;
    city: string;
    zipcode: string;
    geo: {
      lat: string;
      lng: string;
    };
  };
  phone: string;
  website: string;
  company: {
    name: string;
    catchPhrase: string;
    bs: string;
  };
}

export default function UsersScreen({ navigation }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const colorScheme = useColorScheme();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        'https://jsonplaceholder.typicode.com/users',
      );
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleUserPress = (user: User) => {
    navigation.getParent()?.navigate('UserPosts', { id: user.id.toString() });
  };

  const renderUser = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={[
        styles.userCard,
        { backgroundColor: Colors[colorScheme ?? 'light'].background },
      ]}
      onPress={() => handleUserPress(item)}
      accessibilityLabel={`View user profile for ${item.name}`}
      accessibilityRole="button"
      testID={`user-card-${item.id}`}
    >
      <View style={styles.userHeader}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: Colors[colorScheme ?? 'light'].tint },
          ]}
        >
          <Text style={styles.avatarText}>
            {item.name
              .split(' ')
              .map(n => n[0])
              .join('')}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <ThemedText style={styles.userName}>{item.name}</ThemedText>
          <ThemedText style={styles.userUsername}>@{item.username}</ThemedText>
        </View>
      </View>

      <ThemedText style={styles.userEmail}>{item.email}</ThemedText>
      <ThemedText style={styles.userLocation}>
        📍 {item.address.city}, {item.address.zipcode}
      </ThemedText>
      <ThemedText style={styles.userCompany}>🏢 {item.company.name}</ThemedText>
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
          <ThemedText style={styles.loadingText}>Loading users...</ThemedText>
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
            onPress={fetchUsers}
            accessibilityLabel="Retry loading users"
            accessibilityRole="button"
            testID="retry-users-button"
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </ThemedView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Users</ThemedText>
        <ThemedText style={styles.subtitle}>
          Tap on a user to view details or see their posts
        </ThemedText>
      </ThemedView>

      <FlatList
        data={users}
        renderItem={renderUser}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
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
  userCard: {
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
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  userUsername: {
    fontSize: 14,
    opacity: 0.7,
  },
  userEmail: {
    fontSize: 14,
    marginBottom: 4,
    opacity: 0.8,
  },
  userLocation: {
    fontSize: 12,
    marginBottom: 4,
    opacity: 0.6,
  },
  userCompany: {
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
