import { Colors } from '@/constants/theme'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { router, useLocalSearchParams } from 'expo-router'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

interface User {
  id: number
  name: string
  username: string
  email: string
  address: {
    street: string
    suite: string
    city: string
    zipcode: string
    geo: {
      lat: string
      lng: string
    }
  }
  phone: string
  website: string
  company: {
    name: string
    catchPhrase: string
    bs: string
  }
}

export default function UserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const colorScheme = useColorScheme()

  useEffect(() => {
    if (id) {
      fetchUser()
    }
  }, [id])

  const fetchUser = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`https://jsonplaceholder.typicode.com/users/${id}`)
      if (!response.ok) {
        throw new Error('Failed to fetch user')
      }
      const data = await response.json()
      setUser(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ThemedView style={styles.centerContainer}>
          <ActivityIndicator size='large' color={Colors[colorScheme ?? 'light'].tint} />
          <ThemedText style={styles.loadingText}>Loading user...</ThemedText>
        </ThemedView>
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <ThemedView style={styles.centerContainer}>
          <ThemedText style={styles.errorText}>Error: {error}</ThemedText>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}
            onPress={fetchUser}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </ThemedView>
      </SafeAreaView>
    )
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <ThemedView style={styles.centerContainer}>
          <ThemedText style={styles.errorText}>User not found</ThemedText>
        </ThemedView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ThemedView style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={[styles.backButtonText, { color: Colors[colorScheme ?? 'light'].tint }]}>← Back</Text>
        </TouchableOpacity>
      </ThemedView>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <ThemedView style={styles.userCard}>
          <View style={styles.userHeader}>
            <View style={[styles.avatar, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}>
              <Text style={styles.avatarText}>
                {user.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <ThemedText type='title'>{user.name}</ThemedText>
              <ThemedText style={styles.username}>@{user.username}</ThemedText>
            </View>
          </View>

          <View style={styles.detailsSection}>
            <ThemedText style={styles.sectionTitle}>Contact Information</ThemedText>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>📧 Email:</Text>
              <ThemedText style={styles.detailValue}>{user.email}</ThemedText>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>📱 Phone:</Text>
              <ThemedText style={styles.detailValue}>{user.phone}</ThemedText>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>🌐 Website:</Text>
              <ThemedText style={styles.detailValue}>{user.website}</ThemedText>
            </View>
          </View>

          <View style={styles.detailsSection}>
            <ThemedText style={styles.sectionTitle}>Address</ThemedText>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>🏠 Street:</Text>
              <ThemedText style={styles.detailValue}>{user.address.street}</ThemedText>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>🏢 Suite:</Text>
              <ThemedText style={styles.detailValue}>{user.address.suite}</ThemedText>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>🏙️ City:</Text>
              <ThemedText style={styles.detailValue}>{user.address.city}</ThemedText>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>📮 Zipcode:</Text>
              <ThemedText style={styles.detailValue}>{user.address.zipcode}</ThemedText>
            </View>
          </View>

          <View style={styles.detailsSection}>
            <ThemedText style={styles.sectionTitle}>Company</ThemedText>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>🏢 Name:</Text>
              <ThemedText style={styles.detailValue}>{user.company.name}</ThemedText>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>💬 Catchphrase:</Text>
              <ThemedText style={styles.detailValue}>{user.company.catchPhrase}</ThemedText>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>💼 Business:</Text>
              <ThemedText style={styles.detailValue}>{user.company.bs}</ThemedText>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}
            onPress={() => router.push(`/user-posts/${user.id}`)}
          >
            <Text style={styles.actionButtonText}>View Posts</Text>
          </TouchableOpacity>
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  header: {
    padding: 20,
    paddingBottom: 10
  },
  backButton: {
    marginBottom: 10
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600'
  },
  scrollView: {
    flex: 1
  },
  userCard: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4
    },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 8
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15
  },
  avatarText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 20
  },
  userInfo: {
    flex: 1
  },
  username: {
    fontSize: 16,
    opacity: 0.7,
    marginTop: 5
  },
  detailsSection: {
    marginBottom: 20
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    opacity: 0.8
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start'
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    width: 100,
    opacity: 0.7
  },
  detailValue: {
    fontSize: 14,
    flex: 1,
    opacity: 0.8
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
    marginBottom: 20
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold'
  }
})
