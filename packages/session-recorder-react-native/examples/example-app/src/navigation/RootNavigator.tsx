import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import HomeScreen from '../screens/HomeScreen';
import ExploreScreen from '../screens/ExploreScreen';
import PostsScreen from '../screens/PostsScreen';
import UsersScreen from '../screens/UsersScreen';
import UserScreen from '../screens/UserScreen';
import UserPostsScreen from '../screens/UserPostsScreen';
import PostScreen from '../screens/PostScreen';
import ModalScreen from '../screens/ModalScreen';
import { Colors } from '../constants/theme';
import { useColorScheme } from '../hooks/use-color-scheme';

export type RootStackParamList = {
  MainTabs: undefined;
  User: { id: string };
  UserPosts: { id: string };
  Post: { id: string };
  Modal: undefined;
};

export type TabParamList = {
  Home: undefined;
  Explore: undefined;
  Posts: undefined;
  Users: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function TabNavigator() {
  const colorScheme = useColorScheme();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>🏠</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Explore"
        component={ExploreScreen}
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>🧭</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Posts"
        component={PostsScreen}
        options={{
          title: 'Posts',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>📄</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Users"
        component={UsersScreen}
        options={{
          title: 'Users',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>👥</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="MainTabs"
        component={TabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="User"
        component={UserScreen}
        options={{ title: 'User' }}
      />
      <Stack.Screen
        name="UserPosts"
        component={UserPostsScreen}
        options={{ title: 'User Posts' }}
      />
      <Stack.Screen
        name="Post"
        component={PostScreen}
        options={{ title: 'Post' }}
      />
      <Stack.Screen
        name="Modal"
        component={ModalScreen}
        options={{ presentation: 'modal', title: 'Modal' }}
      />
    </Stack.Navigator>
  );
}
