import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  TextInput,
  Animated,
  Keyboard,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { commonStyles } from '../styles/common';
import { useConnectionRequests } from '../hooks/useConnectionRequests';
import { useBadgeCounts } from '../hooks/useBadgeCounts';
import { supabase } from '../integrations/supabase/client';
import AppLoading from '../components/AppLoading';
import { useTheme } from '../contexts/ThemeContext';

type SentStatusFilter = 'all' | 'pending' | 'accepted' | 'rejected';
type SortOrder = 'default' | 'az' | 'za';

const ConnectionRequestsScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  const [activeTab, setActiveTab] = useState('received');
  const [loading, setLoading] = useState(true);
  const [receivedRequestsWithProfiles, setReceivedRequestsWithProfiles] = useState([]);
  const [sentRequestsWithProfiles, setSentRequestsWithProfiles] = useState([]);
  const [connectionsWithProfiles, setConnectionsWithProfiles] = useState([]);

  // Search
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);
  const searchAnim = useRef(new Animated.Value(0)).current;

  // Filter
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [sentStatusFilter, setSentStatusFilter] = useState<SentStatusFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('default');

  const {
    sentRequests,
    receivedRequests,
    connections,
    respondToRequest,
    loadConnectionRequests
  } = useConnectionRequests();

  const { refreshConnectionsBadgeCount } = useBadgeCounts();

  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    const showSpinner = !hasLoadedOnce.current;
    hasLoadedOnce.current = true;
    loadRequestsWithProfiles(showSpinner);
  }, [receivedRequests, sentRequests, connections]);

  useFocusEffect(
    React.useCallback(() => {
      refreshConnectionsBadgeCount();
      loadConnectionRequests();
    }, [refreshConnectionsBadgeCount, loadConnectionRequests])
  );

  const toggleSearch = () => {
    if (searchVisible) {
      Keyboard.dismiss();
      setSearchQuery('');
      Animated.timing(searchAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
        setSearchVisible(false)
      );
    } else {
      setSearchVisible(true);
      Animated.timing(searchAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start(() =>
        searchInputRef.current?.focus()
      );
    }
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (activeTab === 'sent' && sentStatusFilter !== 'all') count++;
    if (activeTab === 'connected' && sortOrder !== 'default') count++;
    return count;
  };

  const handleProfileNavigation = async (userId: string) => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      const { data: blockedMe } = await supabase
        .from('blocked_users')
        .select('*')
        .eq('blocker_id', userId)
        .eq('blocked_id', currentUser.id);

      if (blockedMe && blockedMe.length > 0) {
        Alert.alert('Profile Unavailable', 'You have been blocked by this user and cannot view their profile.');
        return;
      }

      navigation.navigate('UserProfile', { userId });
    } catch (error) {
      console.error('Error checking block status:', error);
      navigation.navigate('UserProfile', { userId });
    }
  };

  const loadRequestsWithProfiles = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const receivedWithProfiles = await Promise.all(
        receivedRequests
          .filter(req => req.status === 'pending')
          .map(async (request) => {
            const [{ data: senderProfile }, { data: firstImpression }] = await Promise.all([
              supabase
                .from('profiles')
                .select('name, age, bio, photos, interests, is_online')
                .eq('id', request.sender_id)
                .single(),
              supabase
                .from('first_impressions')
                .select('message, created_at')
                .eq('sender_id', request.sender_id)
                .eq('receiver_id', request.receiver_id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single()
            ]);

            return {
              ...request,
              profile: senderProfile || { name: 'Unknown', age: 0, bio: '', photos: [], interests: [] },
              firstImpression: firstImpression?.message || null,
              mutualInterests: [],
            };
          })
      );

      const sentWithProfiles = await Promise.all(
        sentRequests.map(async (request) => {
          const { data: receiverProfile } = await supabase
            .from('profiles')
            .select('name, age, bio, photos, is_online')
            .eq('id', request.receiver_id)
            .single();

          return {
            ...request,
            profile: receiverProfile || { name: 'Unknown', age: 0, bio: '', photos: [] },
          };
        })
      );

      const connectionsWithProfilesData = await Promise.all(
        connections.map(async (userId) => {
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('name, age, bio, photos, interests, is_online')
            .eq('id', userId)
            .single();

          return {
            id: userId,
            profile: userProfile || { name: 'Unknown', age: 0, bio: '', photos: [], interests: [] },
          };
        })
      );

      setReceivedRequestsWithProfiles(receivedWithProfiles);
      setSentRequestsWithProfiles(sentWithProfiles);
      setConnectionsWithProfiles(connectionsWithProfilesData);
    } catch (error) {
      console.error('Error loading requests with profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (requestId) => {
    const success = await respondToRequest(requestId, 'accepted');
    if (success) {
      setReceivedRequestsWithProfiles(prev => prev.filter(item => item.id !== requestId));
    }
  };

  const getRelativeTime = (dateString: string): string => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const handleCancelRequest = (requestId: string, userName: string) => {
    Alert.alert(
      'Cancel Request',
      `Are you sure you want to cancel the connection request to ${userName}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: deleted, error } = await supabase
                .from('connection_requests')
                .delete()
                .eq('id', requestId)
                .select();

              if (error) {
                console.error('Error cancelling request:', error);
                Alert.alert('Error', 'Failed to cancel request. Please try again.');
                return;
              }

              if (!deleted || deleted.length === 0) {
                // RLS blocked DELETE silently — run this SQL in Supabase:
                // CREATE POLICY "Senders can delete own requests"
                // ON connection_requests FOR DELETE USING (sender_id = auth.uid());
                console.error('RLS blocked cancel DELETE. Need SQL policy fix in Supabase.');
                Alert.alert('Error', 'Permission denied. Please contact support.');
                return;
              }

              // Immediately remove from local state for instant UI update
              setSentRequestsWithProfiles(prev => prev.filter(item => item.id !== requestId));
              // Refresh hook data in background
              loadConnectionRequests();
            } catch (err) {
              console.error('Error cancelling request:', err);
            }
          },
        },
      ]
    );
  };

  const handleDecline = async (requestId) => {
    const success = await respondToRequest(requestId, 'rejected');
    if (success) {
      setReceivedRequestsWithProfiles(prev => prev.filter(item => item.id !== requestId));
    }
  };

  const handleChatWithUser = async (userId, userName) => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      const { data: existingRoom } = await supabase
        .from('chat_rooms')
        .select('*')
        .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${userId}),and(user1_id.eq.${userId},user2_id.eq.${currentUser.id})`)
        .single();

      let roomId;

      if (existingRoom) {
        roomId = existingRoom.id;
      } else {
        const user1 = currentUser.id < userId ? currentUser.id : userId;
        const user2 = currentUser.id < userId ? userId : currentUser.id;

        const { data: newRoom, error } = await supabase
          .from('chat_rooms')
          .insert({
            user1_id: user1,
            user2_id: user2,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          if (error.code === '23505') {
            const { data: existingRoomRetry } = await supabase
              .from('chat_rooms')
              .select('*')
              .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${userId}),and(user1_id.eq.${userId},user2_id.eq.${currentUser.id})`)
              .single();

            if (existingRoomRetry) {
              roomId = existingRoomRetry.id;
            } else {
              Alert.alert('Error', 'Failed to create or find chat room');
              return;
            }
          } else {
            Alert.alert('Error', 'Failed to create chat room');
            return;
          }
        } else {
          roomId = newRoom.id;
        }
      }

      navigation.navigate('ChatRoom', { roomId, otherUserId: userId, otherUserName: userName });
    } catch (error) {
      console.error('Error navigating to chat:', error);
      Alert.alert('Error', 'Failed to open chat');
    }
  };

  // Apply search + filter to the current tab's list
  const getFilteredList = () => {
    let base =
      activeTab === 'received' ? receivedRequestsWithProfiles :
        activeTab === 'sent' ? sentRequestsWithProfiles :
          connectionsWithProfiles;

    // Search by name
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      base = base.filter(item => item.profile.name?.toLowerCase().includes(q));
    }

    // Status filter (sent tab)
    if (activeTab === 'sent' && sentStatusFilter !== 'all') {
      base = base.filter(item => item.status === sentStatusFilter);
    }

    // Sort order (connected tab)
    if (activeTab === 'connected' && sortOrder !== 'default') {
      base = [...base].sort((a, b) => {
        const nameA = a.profile.name?.toLowerCase() || '';
        const nameB = b.profile.name?.toLowerCase() || '';
        return sortOrder === 'az' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      });
    }

    return base;
  };

  const resetFilters = () => {
    setSentStatusFilter('all');
    setSortOrder('default');
  };

  const renderReceivedRequest = ({ item }) => {
    const interests: string[] = item.profile.interests?.slice(0, 2) || [];
    const subText = item.firstImpression
      ? `"${item.firstImpression}"`
      : interests.length > 0
        ? interests.join(', ')
        : item.profile.bio || '';

    return (
      <View style={styles.requestCard}>
        {/* Avatar */}
        <TouchableOpacity onPress={() => handleProfileNavigation(item.sender_id)}>
          <View style={styles.avatarWrapper}>
            {item.profile.photos?.[0] ? (
              <Image source={{ uri: item.profile.photos[0] }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={28} color={theme.colors.textSecondary} />
              </View>
            )}
            {item.profile.is_online && <View style={styles.onlineDot} />}
          </View>
        </TouchableOpacity>

        {/* Info */}
        <TouchableOpacity
          style={styles.requestInfo}
          onPress={() => handleProfileNavigation(item.sender_id)}
        >
          <Text style={styles.userName}>{item.profile.name}</Text>
          {subText ? (
            <Text style={styles.userSubText} numberOfLines={1}>{subText}</Text>
          ) : null}
        </TouchableOpacity>

        {/* Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.declineButton]}
            onPress={() => handleDecline(item.id)}
          >
            <Ionicons name="close" size={20} color="#999" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => handleAccept(item.id)}
          >
            <Ionicons name="checkmark" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSentRequest = ({ item }) => (
    <View style={styles.sentCard}>
      {/* Corner badge */}
      {item.status === 'pending' ? (
        <View style={styles.cornerBadgePending}>
          <Text style={styles.cornerBadgeText}>Pending</Text>
        </View>
      ) : item.status === 'accepted' ? (
        <View style={styles.cornerBadgeAccepted}>
          <Text style={styles.cornerBadgeText}>Accepted</Text>
        </View>
      ) : (
        <View style={styles.cornerBadgeRejected}>
          <Text style={styles.cornerBadgeText}>Rejected</Text>
        </View>
      )}

      <TouchableOpacity onPress={() => handleProfileNavigation(item.receiver_id)}>
        <View style={styles.avatarWrapper}>
          {item.profile.photos?.[0] ? (
            <Image source={{ uri: item.profile.photos[0] }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={28} color={theme.colors.textSecondary} />
            </View>
          )}
          {item.profile.is_online && <View style={styles.onlineDot} />}
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.requestInfo} onPress={() => handleProfileNavigation(item.receiver_id)}>
        <Text style={styles.userName}>{item.profile.name}</Text>
        <View style={styles.sentTimeRow}>
          <Ionicons name="time-outline" size={13} color={theme.colors.textSecondary} />
          <Text style={styles.sentTimeText}>Sent {getRelativeTime(item.created_at)}</Text>
        </View>
      </TouchableOpacity>

      {item.status === 'pending' && (
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => handleCancelRequest(item.id, item.profile.name)}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderConnection = ({ item }) => (
    <View style={styles.requestCard}>
      <TouchableOpacity onPress={() => handleProfileNavigation(item.id)}>
        <View style={styles.avatarWrapper}>
          {item.profile.photos?.[0] ? (
            <Image source={{ uri: item.profile.photos[0] }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={28} color={theme.colors.textSecondary} />
            </View>
          )}
          {item.profile.is_online && <View style={styles.onlineDot} />}
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.requestInfo} onPress={() => handleProfileNavigation(item.id)}>
        <Text style={styles.userName}>{item.profile.name}, {item.profile.age}</Text>
        {item.profile.interests && item.profile.interests.length > 0 ? (
          <View style={styles.interestsRow}>
            <Ionicons name="heart" size={13} color={theme.colors.primary} />
            <Text style={styles.interestsText}>{item.profile.interests.length} interests</Text>
          </View>
        ) : item.profile.bio ? (
          <Text style={styles.userSubText} numberOfLines={1}>{item.profile.bio}</Text>
        ) : null}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionButton, styles.chatButton]}
        onPress={() => handleChatWithUser(item.id, item.profile.name)}
      >
        <Ionicons name="chatbubble-outline" size={20} color={theme.colors.primary} />
      </TouchableOpacity>
    </View>
  );

  const filteredList = getFilteredList();
  const activeFiltersCount = getActiveFiltersCount();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('Home')}>
          <Image
            source={require('../../assets/logos/darkmode_logo.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Connections</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIconButton} onPress={toggleSearch}>
            <Ionicons
              name={searchVisible ? 'close' : 'search'}
              size={22}
              color={searchVisible ? theme.colors.primary : theme.colors.text}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconButton} onPress={() => setShowFilterModal(true)}>
            <Ionicons name="funnel" size={20} color="#4CAF50" />
            {activeFiltersCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      {searchVisible && (
        <Animated.View style={[styles.searchBar, { opacity: searchAnim }]}>
          <Ionicons name="search" size={18} color="#999" style={{ marginRight: 8 }} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Search by name..."
            placeholderTextColor="#bbb"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#bbb" />
            </TouchableOpacity>
          )}
        </Animated.View>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'received' && styles.activeTab]}
          onPress={() => setActiveTab('received')}
        >
          <Text style={[styles.tabText, activeTab === 'received' && styles.activeTabText]}>
            Received ({receivedRequestsWithProfiles.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'sent' && styles.activeTab]}
          onPress={() => setActiveTab('sent')}
        >
          <Text style={[styles.tabText, activeTab === 'sent' && styles.activeTabText]}>
            Sent ({sentRequestsWithProfiles.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'connected' && styles.activeTab]}
          onPress={() => setActiveTab('connected')}
        >
          <Text style={[styles.tabText, activeTab === 'connected' && styles.activeTabText]}>
            Partners ({connectionsWithProfiles.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading ? (
        <View style={commonStyles.centerContainer}>
          <AppLoading />
        </View>
      ) : filteredList.length === 0 ? (
        <View style={commonStyles.centerContainer}>
          <Ionicons name="people-outline" size={64} color={theme.colors.gray[300]} />
          <Text style={styles.emptyText}>
            {searchQuery.trim()
              ? 'No results found'
              : activeTab === 'connected'
                ? 'No activity partners'
                : `No ${activeTab} requests`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredList}
          renderItem={
            activeTab === 'received' ? renderReceivedRequest :
              activeTab === 'sent' ? renderSentRequest :
                renderConnection
          }
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowFilterModal(false)}
        >
          <View style={styles.filterModal}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>Filter</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {/* Sent tab: status filter */}
            {activeTab === 'sent' && (
              <>
                <Text style={styles.filterSectionTitle}>Status</Text>
                <View style={styles.filterOptions}>
                  {(['all', 'pending', 'accepted', 'rejected'] as SentStatusFilter[]).map(status => (
                    <TouchableOpacity
                      key={status}
                      style={[styles.filterOption, sentStatusFilter === status && styles.filterOptionActive]}
                      onPress={() => setSentStatusFilter(status)}
                    >
                      <Text style={[styles.filterOptionText, sentStatusFilter === status && styles.filterOptionTextActive]}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Connected tab: sort order */}
            {activeTab === 'connected' && (
              <>
                <Text style={styles.filterSectionTitle}>Sort By</Text>
                <View style={styles.filterOptions}>
                  {([
                    { value: 'default', label: 'Default' },
                    { value: 'az', label: 'Name A → Z' },
                    { value: 'za', label: 'Name Z → A' },
                  ] as { value: SortOrder; label: string }[]).map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.filterOption, sortOrder === opt.value && styles.filterOptionActive]}
                      onPress={() => setSortOrder(opt.value)}
                    >
                      <Text style={[styles.filterOptionText, sortOrder === opt.value && styles.filterOptionTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Received tab: no filters */}
            {activeTab === 'received' && (
              <View style={styles.noFilterContainer}>
                <Ionicons name="checkmark-circle-outline" size={40} color={theme.colors.gray[300]} />
                <Text style={styles.noFilterText}>No filters available for received requests</Text>
              </View>
            )}

            <View style={styles.filterModalActions}>
              {activeFiltersCount > 0 && (
                <TouchableOpacity style={styles.resetButton} onPress={resetFilters}>
                  <Text style={styles.resetButtonText}>Reset</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.applyButton}
                onPress={() => setShowFilterModal(false)}
              >
                <Text style={styles.applyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const makeStyles = (t: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: t.spacing.xs,
    paddingRight: t.spacing.md,
    paddingLeft: 12,
    backgroundColor: t.colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  headerTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    color: t.colors.text,
    pointerEvents: 'none',
  },
  headerLogo: {
    width: 120,
    height: 40,
    marginLeft: 0,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: t.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  filterBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: t.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    padding: 0,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: t.spacing.lg,
    marginBottom: t.spacing.md,
    backgroundColor: t.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: t.spacing.sm,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: t.colors.primary,
  },
  tabText: {
    fontSize: t.fontSize.base,
    color: t.colors.textSecondary,
  },
  activeTabText: {
    color: t.colors.primary,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: t.spacing.lg,
    paddingTop: t.spacing.md,
    paddingBottom: t.spacing.lg,
  },
  requestCard: {
    backgroundColor: t.colors.surface,
    borderRadius: t.borderRadius.lg,
    paddingHorizontal: t.spacing.md,
    paddingVertical: 12,
    marginBottom: t.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  requestContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  avatarPlaceholder: {
    backgroundColor: t.colors.gray[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: t.colors.surface,
  },
  requestInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: t.colors.text,
    marginBottom: 3,
  },
  userSubText: {
    fontSize: 13,
    color: t.colors.textSecondary,
  },
  userBio: {
    fontSize: t.fontSize.sm,
    color: t.colors.textSecondary,
    marginBottom: t.spacing.xs,
  },
  mutualInterests: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mutualText: {
    fontSize: t.fontSize.xs,
    color: t.colors.primary,
    marginLeft: t.spacing.xs,
  },
  sentTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  sentTimeText: {
    fontSize: 13,
    color: t.colors.textSecondary,
  },
  sentCard: {
    backgroundColor: t.colors.surface,
    borderRadius: t.borderRadius.lg,
    paddingHorizontal: t.spacing.md,
    paddingVertical: 12,
    paddingTop: 20,
    marginBottom: t.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    position: 'relative',
    overflow: 'visible',
  },
  cornerBadgePending: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: t.colors.warning,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    zIndex: 1,
  },
  cornerBadgeAccepted: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: t.colors.success,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    zIndex: 1,
  },
  cornerBadgeRejected: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: t.colors.error,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    zIndex: 1,
  },
  cornerBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },
  sentActions: {
    alignItems: 'flex-end',
    gap: 6,
  },
  cancelButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: t.colors.textSecondary,
  },
  interestsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  interestsText: {
    fontSize: 13,
    color: t.colors.primary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgePending: {
    borderColor: t.colors.warning,
    backgroundColor: t.colors.warning + '15',
  },
  statusBadgeAccepted: {
    borderColor: t.colors.success,
    backgroundColor: t.colors.success + '15',
  },
  statusBadgeRejected: {
    borderColor: t.colors.error,
    backgroundColor: t.colors.error + '15',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  declineButton: {
    borderColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
  },
  acceptButton: {
    borderColor: '#4CAF50',
    backgroundColor: '#4CAF50',
  },
  chatButton: {
    borderColor: t.colors.primary,
    backgroundColor: t.colors.primary + '10',
  },
  statusContainer: {
    marginTop: t.spacing.xs,
  },
  statusText: {
    fontSize: t.fontSize.xs,
    fontWeight: '500',
  },
  pendingStatus: {
    color: t.colors.warning,
  },
  acceptedStatus: {
    color: t.colors.success,
  },
  rejectedStatus: {
    color: t.colors.error,
  },
  emptyText: {
    marginTop: t.spacing.md,
    fontSize: t.fontSize.lg,
    color: t.colors.textSecondary,
  },
  firstImpressionContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: t.spacing.xs,
    gap: t.spacing.xs,
  },
  firstImpressionText: {
    flex: 1,
    fontSize: t.fontSize.sm,
    color: t.colors.primary,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  // Filter Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  filterModal: {
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: t.spacing.lg,
    paddingBottom: t.spacing.xl * 2,
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: t.spacing.lg,
  },
  filterModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: t.colors.text,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: t.colors.text,
    marginBottom: t.spacing.sm,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.sm,
    marginBottom: t.spacing.md,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.background,
  },
  filterOptionActive: {
    borderColor: t.colors.primary,
    backgroundColor: t.colors.primary + '15',
  },
  filterOptionText: {
    fontSize: 14,
    color: t.colors.textSecondary,
  },
  filterOptionTextActive: {
    color: t.colors.primary,
    fontWeight: '600',
  },
  noFilterContainer: {
    alignItems: 'center',
    paddingVertical: t.spacing.xl,
    gap: t.spacing.md,
  },
  noFilterText: {
    fontSize: 14,
    color: t.colors.textSecondary,
    textAlign: 'center',
  },
  filterModalActions: {
    flexDirection: 'row',
    gap: t.spacing.md,
    marginTop: t.spacing.md,
  },
  resetButton: {
    flex: 1,
    paddingVertical: t.spacing.md,
    borderRadius: t.borderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  resetButtonText: {
    color: t.colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  applyButton: {
    flex: 1,
    backgroundColor: t.colors.primary,
    paddingVertical: t.spacing.md,
    borderRadius: t.borderRadius.lg,
    alignItems: 'center',
  },
  applyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ConnectionRequestsScreen;
