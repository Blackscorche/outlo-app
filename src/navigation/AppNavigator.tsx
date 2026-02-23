import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MapScreen from '../screens/MapScreen';
import ChatRoomsScreen from '../screens/ChatRoomsScreen';
import ChatRoomScreen from '../screens/ChatRoomScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AuthScreen from '../screens/AuthScreen';
import ConnectionRequestsScreen from '../screens/ConnectionRequestsScreen';
import ActivitiesScreen from '../screens/ActivitiesScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import FriendsScreen from '../screens/FriendsScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const ChatStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="ChatRooms" component={ChatRoomsScreen} options={{ title: 'Messages' }} />
    <Stack.Screen name="ChatRoom" component={ChatRoomScreen} />
  </Stack.Navigator>
);

const SettingsStack = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="SettingsMain"
      component={SettingsScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="Profile"
      component={ProfileScreen}
      options={{
        title: 'My Profile',
        headerStyle: { backgroundColor: '#FFF' },
        headerTintColor: '#333',
        headerShadowVisible: false,
      }}
    />
  </Stack.Navigator>
);

interface CustomTabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
}

const CustomTabBar = ({ state, navigation }: CustomTabBarProps) => {
  const insets = useSafeAreaInsets();

  const getIcon = (routeName: string, focused: boolean): keyof typeof Ionicons.glyphMap => {
    switch (routeName) {
      case 'Activities':
        return focused ? 'calendar' : 'calendar-outline';
      case 'Messages':
        return focused ? 'chatbubble' : 'chatbubble-outline';
      case 'Home':
        return 'home';
      case 'Connections':
        return focused ? 'people' : 'people-outline';
      case 'Settings':
        return focused ? 'settings' : 'settings-outline';
      default:
        return 'help-outline';
    }
  };

  return (
    <View style={[styles.tabBarContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 8 }]}>
      {state.routes.map((route: any, index: number) => {
        const focused = state.index === index;
        const isCenter = route.name === 'Home';

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        if (isCenter) {
          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.centerTabWrapper}
            >
              <View style={[styles.centerButton, focused && styles.centerButtonFocused]}>
                <Ionicons name="home" size={28} color="#FFF" />
              </View>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tabItem}
          >
            <Ionicons
              name={getIcon(route.name, focused)}
              size={24}
              color={focused ? '#FF4A6E' : '#999'}
            />
            <View style={styles.tabLabelContainer}>
              {focused && <View style={styles.activeIndicator} />}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const MainTabs = () => (
  <Tab.Navigator
    tabBar={(props) => <CustomTabBar {...props} />}
    screenOptions={{
      headerShown: false,
    }}
  >
    <Tab.Screen name="Activities" component={ActivitiesScreen} />
    <Tab.Screen name="Messages" component={ChatStack} />
    <Tab.Screen name="Home" component={MapScreen} />
    <Tab.Screen name="Connections" component={ConnectionRequestsScreen} />
    <Tab.Screen name="Settings" component={SettingsStack} />
  </Tab.Navigator>
);

const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Auth" component={AuthScreen} />
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="ConnectionRequests" component={ConnectionRequestsScreen} />
        <Stack.Screen name="Favorites" component={FavoritesScreen} />
        <Stack.Screen name="Friends" component={FriendsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
    borderTopWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 15,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  tabLabelContainer: {
    height: 6,
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIndicator: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FF4A6E',
  },
  centerTabWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: -28,
  },
  centerButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FF4A6E',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF4A6E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 10,
  },
  centerButtonFocused: {
    backgroundColor: '#E8143E',
    shadowOpacity: 0.5,
  },
});

export default AppNavigator;
