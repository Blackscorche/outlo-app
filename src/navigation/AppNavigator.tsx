import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import MapScreen from '../screens/MapScreen';
import ChatRoomsScreen from '../screens/ChatRoomsScreen';
import ChatRoomScreen from '../screens/ChatRoomScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AuthScreen from '../screens/AuthScreen';
import ConnectionRequestsScreen from '../screens/ConnectionRequestsScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import FriendsScreen from '../screens/FriendsScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const ChatStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="ChatRooms" component={ChatRoomsScreen} options={{ title: 'Chats' }} />
    <Stack.Screen name="ChatRoom" component={ChatRoomScreen} />
  </Stack.Navigator>
);

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color, size }) => {
        let iconName;

        if (route.name === 'Map') {
          iconName = focused ? 'map' : 'map-outline';
        } else if (route.name === 'Chat') {
          iconName = focused ? 'chatbubble' : 'chatbubble-outline';
        } else if (route.name === 'Profile') {
          iconName = focused ? 'person' : 'person-outline';
        } else if (route.name === 'Settings') {
          iconName = focused ? 'settings' : 'settings-outline';
        }

        return <Ionicons name={iconName} size={size} color={color} />;
      },
      tabBarActiveTintColor: '#FF4A6E',
      tabBarInactiveTintColor: 'gray',
    })}
  >
    <Tab.Screen name="Map" component={MapScreen} />
    <Tab.Screen name="Chat" component={ChatStack} options={{ headerShown: false }} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
    <Tab.Screen name="Settings" component={SettingsScreen} />
  </Tab.Navigator>
);

const AppNavigator = () => {
  const isAuthenticated = false; // This will be replaced with actual auth state

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="ConnectionRequests" component={ConnectionRequestsScreen} />
            <Stack.Screen name="Favorites" component={FavoritesScreen} />
            <Stack.Screen name="Friends" component={FriendsScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;