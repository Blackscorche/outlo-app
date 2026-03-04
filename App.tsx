import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Text, StyleSheet, Alert, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './src/integrations/supabase/client';
import { usePresence } from './src/hooks/usePresence';
import { useBadgeCounts } from './src/hooks/useBadgeCounts';
import { useInAppNotifications } from './src/hooks/useInAppNotifications';
import { SettingsProvider, useSettings } from './src/contexts/SettingsContext';
import { ToastProvider } from './src/contexts/ToastContext';
import { SubscriptionProvider } from './src/contexts/SubscriptionContext';
import { IAPProvider } from './src/components/IAPProvider';
import { ImagePickerModal } from './src/utils/imagePicker';
import pushNotificationService, { navigationRef } from './src/services/pushNotificationService';
import engagementNotificationService from './src/services/engagementNotificationService';
import * as KeepAwake from 'expo-keep-awake';

// Import screens
import HomeScreen from './src/screens/HomeScreen';
import AuthScreen from './src/screens/AuthScreen';
import ProfileScreenV2 from './src/screens/ProfileScreenV2';
import UserProfileScreen from './src/screens/UserProfileScreen';
import ChatScreen from './src/screens/ChatScreen';
import ChatRoomScreen from './src/screens/ChatRoomScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ConnectionRequestsScreen from './src/screens/ConnectionRequestsScreen';
import AllPostsScreen from './src/screens/AllPostsScreen';
import PostDetailScreen from './src/screens/PostDetailScreen';
import SubscriptionScreen from './src/screens/SubscriptionScreen';
import SubscriptionSuccessScreen from './src/screens/SubscriptionSuccessScreen';
import ExtraPurchaseSuccessScreen from './src/screens/ExtraPurchaseSuccessScreen';
import ActivitiesScreen from './src/screens/ActivitiesScreen';
import SkillMatchingScreen from './src/screens/SkillMatchingScreen';
import BlockedUsersScreen from './src/screens/BlockedUsersScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const SettingsStack = createNativeStackNavigator();

// Settings stack with Profile inside
function SettingsWithProfile() {
  return (
    <SettingsStack.Navigator>
      <SettingsStack.Screen
        name="SettingsMain"
        component={SettingsScreen}
        options={{ headerShown: false }}
      />
      <SettingsStack.Screen
        name="Profile"
        component={ProfileScreenV2}
        options={{ headerShown: false }}
      />
    </SettingsStack.Navigator>
  );
}

// Icon + badge helper
function getTabIcon(routeName: string, focused: boolean): keyof typeof Ionicons.glyphMap {
  switch (routeName) {
    case 'Activities':
      return focused ? 'calendar' : 'calendar-outline';
    case 'Messages':
      return focused ? 'chatbubbles' : 'chatbubbles-outline';
    case 'Home':
      return 'home';
    case 'Connections':
      return focused ? 'people' : 'people-outline';
    case 'Settings':
      return focused ? 'settings' : 'settings-outline';
    default:
      return 'help-outline';
  }
}

// Custom tab bar with elevated center Home button
function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { chatBadgeCount, connectionsBadgeCount } = useBadgeCounts();

  const getBadgeCount = (routeName: string) => {
    if (routeName === 'Messages') return chatBadgeCount;
    if (routeName === 'Connections') return connectionsBadgeCount;
    return 0;
  };

  return (
    <View style={[tabBarStyles.container, { paddingBottom: insets.bottom > 0 ? insets.bottom : 10 }]}>
      {state.routes.map((route: any, index: number) => {
        const focused = state.index === index;
        const isCenter = route.name === 'Home';
        const badgeCount = getBadgeCount(route.name);

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

        if (isCenter) {
          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              onPress={onPress}
              style={tabBarStyles.centerWrapper}
              activeOpacity={0.8}
            >
              <View style={tabBarStyles.centerButtonOuter}>
                <View style={[tabBarStyles.centerButton, focused && tabBarStyles.centerButtonActive]}>
                  <Ionicons name="home" size={28} color="#FFF" />
                </View>
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
            style={tabBarStyles.tab}
          >
            <View style={tabBarStyles.iconContainer}>
              <Ionicons
                name={getTabIcon(route.name, focused)}
                size={24}
                color={focused ? '#FF1744' : '#999'}
              />
              {badgeCount > 0 && (
                <View style={tabBarStyles.badge}>
                  <Text style={tabBarStyles.badgeText}>
                    {badgeCount > 99 ? '99+' : badgeCount.toString()}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[
              tabBarStyles.label,
              { color: focused ? '#FF1744' : '#999' }
            ]}>
              {route.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Activities" component={ActivitiesScreen} />
      <Tab.Screen name="Messages" component={ChatScreen} />
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Connections" component={ConnectionRequestsScreen} />
      <Tab.Screen name="Settings" component={SettingsWithProfile} />
    </Tab.Navigator>
  );
}

// Custom tab bar for UserProfile screen (all tabs unselected style)
function UserProfileTabBar({ navigation: tabNav, parentNavigation }: any) {
  const insets = useSafeAreaInsets();
  const { chatBadgeCount, connectionsBadgeCount } = useBadgeCounts();

  const tabs = ['Activities', 'Messages', 'Home', 'Connections', 'Settings'];

  const getBadgeCount = (routeName: string) => {
    if (routeName === 'Messages') return chatBadgeCount;
    if (routeName === 'Connections') return connectionsBadgeCount;
    return 0;
  };

  return (
    <View style={[tabBarStyles.container, { paddingBottom: insets.bottom > 0 ? insets.bottom : 10 }]}>
      {tabs.map((name) => {
        const isCenter = name === 'Home';
        const badgeCount = getBadgeCount(name);

        const onPress = () => {
          parentNavigation.navigate('Main', { screen: name });
        };

        if (isCenter) {
          return (
            <TouchableOpacity
              key={name}
              accessibilityRole="button"
              onPress={onPress}
              style={tabBarStyles.centerWrapper}
              activeOpacity={0.8}
            >
              <View style={tabBarStyles.centerButtonOuter}>
                <View style={tabBarStyles.centerButton}>
                  <Ionicons name="home" size={28} color="#FFF" />
                </View>
              </View>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            key={name}
            accessibilityRole="button"
            onPress={onPress}
            style={tabBarStyles.tab}
          >
            <View style={tabBarStyles.iconContainer}>
              <Ionicons
                name={getTabIcon(name, false)}
                size={24}
                color="#999"
              />
              {badgeCount > 0 && (
                <View style={tabBarStyles.badge}>
                  <Text style={tabBarStyles.badgeText}>
                    {badgeCount > 99 ? '99+' : badgeCount.toString()}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[tabBarStyles.label, { color: '#999' }]}>
              {name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// Special tab navigator for UserProfile screen with no selected tab
function UserProfileWithTabs({ navigation, route }: any) {
  const UserProfileScreenWrapper = (props: any) => {
    return <UserProfileScreen {...props} navigation={navigation} route={route} />;
  };

  return (
    <Tab.Navigator
      initialRouteName="UserProfileTab"
      tabBar={(props) => <UserProfileTabBar {...props} parentNavigation={navigation} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Activities" component={EmptyComponent} />
      <Tab.Screen name="Messages" component={EmptyComponent} />
      <Tab.Screen name="Home" component={EmptyComponent} />
      <Tab.Screen name="Connections" component={EmptyComponent} />
      <Tab.Screen name="Settings" component={EmptyComponent} />
      <Tab.Screen
        name="UserProfileTab"
        component={UserProfileScreenWrapper}
        options={{ tabBarButton: () => null }}
      />
    </Tab.Navigator>
  );
}

// Empty component for unused tabs
const EmptyComponent = () => null;

function AuthenticatedApp({ user, navigation }: { user: any; navigation?: any }) {
  const { markActive } = usePresence();
  useInAppNotifications();
  
  // Initialize push notifications and engagement notifications
  useEffect(() => {
    if (user) {
      pushNotificationService.initialize();
      engagementNotificationService.initialize();
    }
    
    return () => {
      pushNotificationService.cleanup();
      engagementNotificationService.cleanup();
    };
  }, [user]);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="ConnectionRequests" component={ConnectionRequestsScreen} />
      <Stack.Screen name="ChatRoom" component={ChatRoomScreen} />
      <Stack.Screen name="AllPosts" component={AllPostsScreen} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
      <Stack.Screen name="Subscription" component={SubscriptionScreen} />
      <Stack.Screen name="SkillMatching" component={SkillMatchingScreen} />
      <Stack.Screen name="SubscriptionSuccess" component={SubscriptionSuccessScreen} />
      <Stack.Screen name="ExtraPurchaseSuccess" component={ExtraPurchaseSuccessScreen} />
      <Stack.Screen name="UserProfile">
        {(props) => <UserProfileWithTabs {...props} />}
      </Stack.Screen>
      <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
    </Stack.Navigator>
  );
}

// Component to manage keep-awake based on settings
function KeepAwakeManager({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  
  useEffect(() => {
    if (settings.keepScreenOn) {
      // Activate keep awake
      KeepAwake.activateKeepAwakeAsync();
    } else {
      // Deactivate keep awake
      KeepAwake.deactivateKeepAwake();
    }
    
    // Cleanup on unmount
    return () => {
      KeepAwake.deactivateKeepAwake();
    };
  }, [settings.keepScreenOn]);
  
  return <>{children}</>;
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const handleAuthError = (error: any) => {
    if (error?.message?.includes('Invalid Refresh Token') || 
        error?.message?.includes('Refresh Token Not Found') ||
        error?.code === 'invalid_refresh_token') {
      console.log('Auth token error detected:', error.message);
      setUser(null);
      Alert.alert(
        'Session Expired',
        'Your login session has expired. Please log in again.',
        [
          {
            text: 'OK',
            onPress: async () => {
              try {
                await supabase.auth.signOut();
              } catch (signOutError) {
                console.error('Error during sign out:', signOutError);
              }
            }
          }
        ]
      );
    }
  };


  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        console.error('Error getting session:', error);
        handleAuthError(error);
        setLoading(false);
        return;
      }
      
      setUser(session?.user ?? null);
      
      setLoading(false);
    }).catch((error) => {
      console.error('Session check failed:', error);
      handleAuthError(error);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);
      
      if (event === 'TOKEN_REFRESHED' && !session) {
        console.log('Token refresh failed, signing out user');
        setUser(null);
        Alert.alert(
          'Session Expired',
          'Your login session has expired. Please log in again.',
          [
            {
              text: 'OK',
              onPress: async () => {
                try {
                  await supabase.auth.signOut();
                } catch (error) {
                  console.error('Error during sign out:', error);
                }
              }
            }
          ]
        );
        return;
      }
      
      if (event === 'TOKEN_REFRESHED') {
        setUser(session?.user ?? null);
        return;
      }

      if (event === 'PASSWORD_RECOVERY') {
        return;
      }

      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);


  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FF1744" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <ToastProvider>
          <SubscriptionProvider>
            <IAPProvider>
            {user ? (
              <KeepAwakeManager>
                <NavigationContainer
                ref={navigationRef}
                linking={{
                  prefixes: ['lovemap://'],
                  config: {
                    screens: {
                      AuthenticatedApp: {
                        path: '',
                        screens: {
                          SubscriptionSuccess: {
                            path: 'subscription-success',
                            parse: {
                              session_id: (session_id: string) => session_id,
                            },
                          },
                          ExtraPurchaseSuccess: {
                            path: 'extra-purchase-success',
                            parse: {
                              session_id: (session_id: string) => session_id,
                              type: (type: string) => type,
                            },
                          },
                        },
                      },
                    },
                  },
                }}
              >
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="AuthenticatedApp">
                    {({ navigation }) => <AuthenticatedApp user={user} navigation={navigation} />}
                  </Stack.Screen>
                </Stack.Navigator>
              </NavigationContainer>
            </KeepAwakeManager>
          ) : (
            <NavigationContainer>
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Auth" component={AuthScreen} />
              </Stack.Navigator>
            </NavigationContainer>
          )}
            </IAPProvider>
          </SubscriptionProvider>
        </ToastProvider>
      </SettingsProvider>
      <StatusBar style="auto" />
      <ImagePickerModal />
    </SafeAreaProvider>
  );
}

const tabBarStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
    borderTopWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 15,
    overflow: 'visible',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '500',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: '#FF1744',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: 'white',
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  centerWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: -28,
  },
  centerButtonOuter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  centerButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF1744',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF1744',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 10,
  },
  centerButtonActive: {
    backgroundColor: '#D50032',
    shadowOpacity: 0.5,
  },
});

const styles = StyleSheet.create({
});
