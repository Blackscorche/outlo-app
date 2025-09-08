import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { chatBadgeCount, connectionsBadgeCount } = useBadgeCounts();

  const TabBarIcon = ({ route, focused, color, size }: any) => {
    let iconName: keyof typeof Ionicons.glyphMap;
    let badgeCount = 0;

    if (route.name === 'Home') {
      iconName = focused ? 'home' : 'home-outline';
    } else if (route.name === 'Chat') {
      iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
      badgeCount = chatBadgeCount;
    } else if (route.name === 'Connections') {
      iconName = focused ? 'people' : 'people-outline';
      badgeCount = connectionsBadgeCount;
    } else if (route.name === 'Profile') {
      iconName = focused ? 'person' : 'person-outline';
    } else if (route.name === 'Settings') {
      iconName = focused ? 'settings' : 'settings-outline';
    } else {
      iconName = 'help-outline';
    }

    return (
      <View style={styles.tabIconContainer}>
        <Ionicons name={iconName} size={size} color={color} />
        {badgeCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {badgeCount > 99 ? '99+' : badgeCount.toString()}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => (
          <TabBarIcon route={route} focused={focused} color={color} size={size} />
        ),
        tabBarActiveTintColor: '#FF1744',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Connections" component={ConnectionRequestsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreenV2} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

// Special tab navigator for UserProfile screen with no selected tab
function UserProfileWithTabs({ navigation, route }: any) {
  const { chatBadgeCount, connectionsBadgeCount } = useBadgeCounts();

  const TabBarIcon = ({ route, focused, color, size }: any) => {
    let iconName: keyof typeof Ionicons.glyphMap;
    let badgeCount = 0;

    if (route.name === 'Home') {
      iconName = 'home-outline'; // Always show outline
    } else if (route.name === 'Chat') {
      iconName = 'chatbubbles-outline'; // Always show outline
      badgeCount = chatBadgeCount;
    } else if (route.name === 'Connections') {
      iconName = 'people-outline'; // Always show outline
      badgeCount = connectionsBadgeCount;
    } else if (route.name === 'Profile') {
      iconName = 'person-outline'; // Always show outline
    } else if (route.name === 'Settings') {
      iconName = 'settings-outline'; // Always show outline
    } else if (route.name === 'UserProfileTab') {
      iconName = 'person-outline';
    } else {
      iconName = 'help-outline';
    }

    return (
      <View style={styles.tabIconContainer}>
        <Ionicons name={iconName} size={size} color={color} />
        {badgeCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {badgeCount > 99 ? '99+' : badgeCount.toString()}
            </Text>
          </View>
        )}
      </View>
    );
  };

  // Create a wrapper component that passes the parent navigation
  const UserProfileScreenWrapper = (props: any) => {
    return <UserProfileScreen {...props} navigation={navigation} route={route} />;
  };

  return (
    <Tab.Navigator
      initialRouteName="UserProfileTab"
      screenOptions={({ route: tabRoute }) => ({
        tabBarIcon: ({ focused, color, size }) => (
          <TabBarIcon route={tabRoute} focused={false} color="gray" size={size} />
        ),
        tabBarActiveTintColor: 'gray', // No active color
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
        tabBarButton: (props) => {
          // Make tab buttons navigate to the actual screens
          if (tabRoute.name === 'UserProfileTab') {
            return <View {...props} />;
          }
          return (
            <TouchableOpacity
              {...props}
              onPress={() => {
                navigation.navigate('Main', { screen: tabRoute.name });
              }}
            />
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={EmptyComponent} />
      <Tab.Screen name="Chat" component={EmptyComponent} />
      <Tab.Screen name="Connections" component={EmptyComponent} />
      <Tab.Screen name="Profile" component={EmptyComponent} />
      <Tab.Screen name="Settings" component={EmptyComponent} />
      <Tab.Screen 
        name="UserProfileTab" 
        component={UserProfileScreenWrapper}
        options={{ tabBarButton: () => null }} // Hide this tab
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
      <Stack.Screen name="SubscriptionSuccess" component={SubscriptionSuccessScreen} />
      <Stack.Screen name="ExtraPurchaseSuccess" component={ExtraPurchaseSuccessScreen} />
      <Stack.Screen name="UserProfile">
        {(props) => <UserProfileWithTabs {...props} />}
      </Stack.Screen>
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

const styles = StyleSheet.create({
  tabIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: '#FF1744',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: 'white',
  },
  badgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
