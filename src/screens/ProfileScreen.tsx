import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../integrations/supabase/client';
import { showImagePickerOptions } from '../utils/imagePicker';
import { useSettings } from '../contexts/SettingsContext';
import AppLoading from '../components/AppLoading';
import PostUploadModal from '../components/PostUploadModal';
import CheckInModal, { CheckInSuccessData } from '../components/CheckInModal';
import PlaceReviewModal from '../components/PlaceReviewModal';
import { usePlaces, Place } from '../hooks/usePlaces';
import { useTheme } from '../contexts/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const POST_SIZE = Math.floor((SCREEN_WIDTH - 32 - 4) / 3);
const HEADER_COLOR = '#FF1744';

interface CheckIn {
  id: string;
  user_id: string;
  location_name: string;
  latitude: number;
  longitude: number;
  description?: string;
  activity_tag?: string;
  is_active: boolean;
  created_at: string;
  expires_at: string;
}

const ProfileScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { settings } = useSettings();
  const { getPlaceById } = usePlaces();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [placeForReview, setPlaceForReview] = useState<Place | null>(null);
  const [lastCheckInId, setLastCheckInId] = useState<string | null>(null);
  const [posts, setPosts] = useState([]);
  const [activeCheckIn, setActiveCheckIn] = useState<CheckIn | null>(null);
  const [joinedDate, setJoinedDate] = useState('');
  const [profile, setProfile] = useState({
    id: '',
    email: '',
    name: '',
    bio: '',
    age: 0,
    location: '',
    interests: [],
    photos: [],
    gender: '',
    looking_for: '',
    relationship_goals: '',
  });
  const [stats, setStats] = useState({
    likes: 0,
    views: 0,
    connections: 0,
    checkIns: 0,
  });

  useEffect(() => {
    loadProfile();
    loadStats();
    loadPosts();
    loadActiveCheckIn();
  }, []);

  useEffect(() => {
    if (profile.photos && profile.photos.length > 0) {
      const hasLocalImages = profile.photos.some(photo => photo.includes('ExperienceData'));
      if (hasLocalImages) cleanupBrokenImages();
    }
  }, [profile.photos]);

  const cleanupBrokenImages = async () => {
    try {
      const validPhotos = profile.photos.filter(
        photo =>
          !photo.includes('ExperienceData') &&
          !photo.includes('ImagePicker') &&
          !photo.includes('file://')
      );
      if (validPhotos.length !== profile.photos.length) {
        setProfile(prev => ({ ...prev, photos: validPhotos }));
        const { error } = await supabase
          .from('profiles')
          .update({ photos: validPhotos, updated_at: new Date().toISOString() })
          .eq('id', profile.id);
        if (error) console.error('Error cleaning up photos:', error);
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  };

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigation.navigate('Auth'); return; }

      if (user.created_at) {
        setJoinedDate(
          new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        );
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        setProfile({
          id: data.id,
          email: user.email || '',
          name: data.name || '',
          bio: data.bio || '',
          age: data.age || 0,
          location: data.location || '',
          interests: Array.isArray(data.interests) ? data.interests : [],
          photos: Array.isArray(data.photos) ? data.photos : [],
          gender: data.gender || '',
          looking_for: data.looking_for || '',
          relationship_goals: data.relationship_goals || '',
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count: connectionsCount } = await supabase
        .from('connections')
        .select('*', { count: 'exact', head: true })
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      const { count: checkInsCount } = await supabase
        .from('check_ins')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_active', true);

      const viewsCount = Math.floor(Math.random() * 50) + 10;
      const likesCount = Math.floor(Math.random() * 30) + 5;

      setStats({
        likes: likesCount,
        views: viewsCount,
        connections: connectionsCount || 0,
        checkIns: checkInsCount || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadPosts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('posts')
        .select('*, post_likes(user_id), post_comments(id)')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(9);

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error loading posts:', error);
    }
  };

  const loadActiveCheckIn = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('check_ins')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setActiveCheckIn(data);
    } catch (error) {
      console.error('Error loading active check-in:', error);
    }
  };

  const handleEndCheckIn = async () => {
    if (!activeCheckIn) return;
    Alert.alert(
      'End Check-in',
      `End check-in at ${activeCheckIn.location_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('check_ins')
                .update({ is_active: false })
                .eq('id', activeCheckIn.id);
              if (error) throw error;
              setActiveCheckIn(null);
              loadStats();
            } catch (err) {
              console.error('Error ending check-in:', err);
              Alert.alert('Error', 'Failed to end check-in');
            }
          },
        },
      ]
    );
  };

  const pickImage = async () => {
    showImagePickerOptions(
      { allowsEditing: true, aspect: [1, 1], quality: 0.8 },
      async (imageUri) => {
        try {
          setSaving(true);
          const uploadedUrl = await uploadImageToStorage(imageUri);
          if (uploadedUrl) {
            const validPhotos = profile.photos.filter(
              photo => photo.includes('supabase') || photo.startsWith('http')
            );
            const newPhotos = [...validPhotos, uploadedUrl];
            setProfile(prev => ({ ...prev, photos: newPhotos }));
            await saveProfileWithNewPhoto(newPhotos);
          } else {
            Alert.alert('Upload Failed', 'Failed to upload image. Please try again.');
          }
        } catch (error) {
          console.error('Error picking/uploading image:', error);
          Alert.alert('Error', 'Failed to upload image');
        } finally {
          setSaving(false);
        }
      }
    );
  };

  const uploadImageToStorage = async (imageUri: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const fileName = `${Date.now()}.jpeg`;
      const filePath = `${user.id}/${fileName}`;

      const response = await fetch(imageUri);
      const blob = await response.blob();

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const base64String = reader.result as string;
            const base64Data = base64String.split(',')[1];
            const decode = atob(base64Data);
            const arrayBuffer = new Uint8Array(decode.length);
            for (let i = 0; i < decode.length; i++) {
              arrayBuffer[i] = decode.charCodeAt(i);
            }
            const { error } = await supabase.storage
              .from('user-photos')
              .upload(filePath, arrayBuffer.buffer, {
                contentType: 'image/jpeg',
                cacheControl: '3600',
                upsert: true,
              });
            if (error) {
              if (error.message?.includes('row-level security policy')) {
                Alert.alert('Storage Permission Error', 'Please ensure storage policies are set up correctly.');
              }
              throw error;
            }
            const { data: { publicUrl } } = supabase.storage
              .from('user-photos')
              .getPublicUrl(filePath);
            resolve(publicUrl);
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = error => reject(error);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Upload Failed', 'Failed to upload image. Please check your internet connection.');
      return null;
    }
  };

  const saveProfileWithNewPhoto = async (newPhotos: string[]) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ photos: newPhotos, updated_at: new Date().toISOString() })
        .eq('id', profile.id);
      if (error) throw error;
    } catch (error) {
      console.error('Error saving profile with new photo:', error);
    }
  };

  const handleSave = async () => {
    if (!profile.name.trim()) { Alert.alert('Error', 'Name is required'); return; }
    if (profile.photos.length < 2) { Alert.alert('Error', 'At least 2 photos are required'); return; }
    if (profile.interests.length < 5) { Alert.alert('Error', 'At least 5 interests are required'); return; }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: profile.name,
          bio: profile.bio,
          age: profile.age,
          location: profile.location,
          interests: profile.interests,
          photos: profile.photos,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);
      if (error) throw error;
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
      loadStats();
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: HEADER_COLOR }} edges={['top']}>
        <View style={{ flex: 1, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' }}>
          <AppLoading />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: HEADER_COLOR }} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={HEADER_COLOR} />
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>

        {/* ── HEADER ── */}
        <View style={styles.headerSection}>
          <TouchableOpacity style={styles.editIconBtn} onPress={() => setIsEditing(!isEditing)}>
            <Ionicons name={isEditing ? 'close' : 'create-outline'} size={20} color="white" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.avatarWrapper}
            onPress={isEditing ? pickImage : undefined}
            activeOpacity={isEditing ? 0.7 : 1}
          >
            {profile.photos && profile.photos[0] ? (
              <Image
                source={{ uri: profile.photos[0] }}
                style={styles.avatar}
                onError={() =>
                  setProfile(prev => ({
                    ...prev,
                    photos: prev.photos.filter(p => !p.includes('ExperienceData')),
                  }))
                }
              />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Ionicons name="person" size={44} color="rgba(255,255,255,0.8)" />
              </View>
            )}
            {isEditing && (
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera-outline" size={14} color="white" />
              </View>
            )}
          </TouchableOpacity>

          {isEditing ? (
            <TextInput
              style={styles.nameInputHeader}
              value={profile.name}
              onChangeText={t => setProfile({ ...profile, name: t })}
              placeholder="Your name"
              placeholderTextColor="rgba(255,255,255,0.5)"
            />
          ) : (
            <Text style={styles.profileName}>{profile.name || 'Your Name'}</Text>
          )}

          <View style={styles.locationRow}>
            <Ionicons name="location-sharp" size={13} color="rgba(255,255,255,0.85)" />
            <Text style={styles.locationText}>{profile.location || 'Location not set'}</Text>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.onlinePill}>
              <View style={styles.greenDot} />
              <Text style={styles.onlineText}>Online now</Text>
            </View>
            {joinedDate ? <Text style={styles.joinedText}>· Joined {joinedDate}</Text> : null}
          </View>

          {/* Extra photos (edit mode) */}
          {isEditing && (
            <View style={styles.photoGalleryRow}>
              {profile.photos.slice(1).map((photo, idx) => (
                <View key={idx} style={{ position: 'relative' }}>
                  <Image source={{ uri: photo }} style={styles.galleryThumb} />
                  <TouchableOpacity
                    style={styles.removeThumbBtn}
                    onPress={() =>
                      setProfile({ ...profile, photos: profile.photos.filter((_, i) => i !== idx + 1) })
                    }
                  >
                    <Ionicons name="close-circle" size={18} color="white" />
                  </TouchableOpacity>
                </View>
              ))}
              {profile.photos.length < 6 && (
                <TouchableOpacity style={styles.addThumbBtn} onPress={pickImage}>
                  <Ionicons name="add" size={22} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* ── CONTENT ── */}
        <View style={styles.content}>

          {/* Stats */}
          <View style={styles.statsCard}>
            <TouchableOpacity style={styles.statItem} onPress={() => navigation.navigate('Connections')}>
              <Text style={styles.statNum}>{formatNumber(stats.connections)}</Text>
              <Text style={styles.statLbl}>Connections</Text>
            </TouchableOpacity>
            <View style={styles.statSep} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{stats.checkIns}</Text>
              <Text style={styles.statLbl}>Check-ins</Text>
            </View>
            <View style={styles.statSep} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{formatNumber(stats.views)}</Text>
              <Text style={styles.statLbl}>Profile Views</Text>
            </View>
            <View style={styles.statSep} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{stats.likes}</Text>
              <Text style={styles.statLbl}>Likes</Text>
            </View>
          </View>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.createPostBtn} onPress={() => setShowPostModal(true)}>
              <Ionicons name="camera-outline" size={18} color="white" />
              <Text style={styles.actionBtnText}>Create Post</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.checkInActionBtn} onPress={() => setShowCheckInModal(true)}>
              <Ionicons name="location-sharp" size={18} color="white" />
              <Text style={styles.actionBtnText}>Check In</Text>
            </TouchableOpacity>
          </View>

          {/* Currently Checked In */}
          {activeCheckIn && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Currently Checked In</Text>
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>Live</Text>
                </View>
              </View>
              <View style={styles.card}>
                <View style={styles.checkInRow}>
                  <View style={styles.checkInIconWrap}>
                    <Ionicons name="location-sharp" size={20} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.checkInName}>{activeCheckIn.location_name}</Text>
                    <Text style={styles.checkInSub}>{activeCheckIn.activity_tag || 'Currently here'}</Text>
                  </View>
                  <TouchableOpacity style={styles.endBtn} onPress={handleEndCheckIn}>
                    <Text style={styles.endBtnText}>End</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* About Me */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About Me</Text>
            <View style={styles.card}>
              {isEditing ? (
                <>
                  <TextInput
                    style={styles.bioEditInput}
                    value={profile.bio}
                    onChangeText={t => setProfile({ ...profile, bio: t })}
                    placeholder="Write something about yourself..."
                    placeholderTextColor={theme.colors.textSecondary}
                    multiline
                    numberOfLines={4}
                  />
                  <View style={styles.editFieldsGroup}>
                    <View style={styles.editRow}>
                      <Text style={styles.editLabel}>Age</Text>
                      <TextInput
                        style={styles.editInput}
                        value={profile.age ? profile.age.toString() : ''}
                        onChangeText={t => setProfile({ ...profile, age: parseInt(t) || 0 })}
                        keyboardType="numeric"
                        placeholder="Age"
                        placeholderTextColor={theme.colors.textSecondary}
                      />
                    </View>
                    <View style={styles.editRow}>
                      <Text style={styles.editLabel}>Location</Text>
                      <TextInput
                        style={styles.editInput}
                        value={profile.location}
                        onChangeText={t => setProfile({ ...profile, location: t })}
                        placeholder="City, Country"
                        placeholderTextColor={theme.colors.textSecondary}
                      />
                    </View>
                  </View>
                </>
              ) : (
                <Text style={styles.bioText}>
                  {profile.bio || 'No bio yet. Tap the edit button to add one!'}
                </Text>
              )}

              {profile.interests && profile.interests.length > 0 && (
                <View style={styles.tagsRow}>
                  {profile.interests.map((tag, idx) => (
                    <View key={idx} style={styles.tagChip}>
                      <Text style={styles.tagText}>{tag}</Text>
                      {isEditing && (
                        <TouchableOpacity
                          onPress={() =>
                            setProfile({
                              ...profile,
                              interests: profile.interests.filter((_, i) => i !== idx),
                            })
                          }
                          style={{ marginLeft: 3 }}
                        >
                          <Ionicons name="close-circle" size={13} color={theme.colors.primary} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* My Posts */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Posts</Text>
              <TouchableOpacity onPress={() => setShowPostModal(true)}>
                <Text style={styles.addLink}>+ Add</Text>
              </TouchableOpacity>
            </View>

            {posts.length > 0 ? (
              <View style={styles.postsGrid}>
                {posts.slice(0, 6).map(post => (
                  <TouchableOpacity key={post.id} style={styles.postCell}>
                    <Image source={{ uri: post.media_url }} style={styles.postImg} resizeMode="cover" />
                    <View style={styles.postLikeBadge}>
                      <Ionicons name="heart" size={11} color="white" />
                      <Text style={styles.postLikeNum}>{post.likes_count || 0}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="images-outline" size={36} color={theme.colors.textSecondary} />
                <Text style={styles.emptyCardText}>No posts yet</Text>
                <TouchableOpacity style={styles.emptyCardBtn} onPress={() => setShowPostModal(true)}>
                  <Text style={styles.emptyCardBtnText}>Create your first post</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Save button (edit mode) */}
          {isEditing && (
            <TouchableOpacity
              style={[styles.saveButton, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          )}

          <View style={{ height: 24 }} />
        </View>
      </ScrollView>

      {/* ── MODALS ── */}
      {showPostModal && (
        <PostUploadModal
          visible={showPostModal}
          onClose={() => setShowPostModal(false)}
          onPostCreated={() => { loadPosts(); setShowPostModal(false); }}
        />
      )}

      {showCheckInModal && (
        <CheckInModal
          visible={showCheckInModal}
          onClose={() => setShowCheckInModal(false)}
          onCheckIn={() => {
            loadActiveCheckIn();
            loadStats();
            setShowCheckInModal(false);
          }}
          onCheckInSuccess={async (data: CheckInSuccessData) => {
            setLastCheckInId(data.checkInId);
            navigation.navigate('Home', {
              showCheckIn: {
                latitude: data.latitude,
                longitude: data.longitude,
                locationName: data.locationName,
                checkInId: data.checkInId,
              },
            });
            if (data.placeId) {
              const place = await getPlaceById(data.placeId);
              if (place) {
                setTimeout(() => {
                  Alert.alert(
                    'Write a Review?',
                    `Would you like to share your experience at ${data.locationName}?`,
                    [
                      { text: 'Not Now', style: 'cancel' },
                      {
                        text: 'Write Review',
                        onPress: () => { setPlaceForReview(place); setShowReviewModal(true); },
                      },
                    ]
                  );
                }, 1000);
              }
            }
          }}
          currentLocation={settings.location}
        />
      )}

      <PlaceReviewModal
        visible={showReviewModal}
        place={placeForReview}
        checkInId={lastCheckInId || undefined}
        onClose={() => { setShowReviewModal(false); setPlaceForReview(null); setLastCheckInId(null); }}
        onSubmitted={() => { Alert.alert('Thank you!', 'Your review has been submitted.'); }}
      />
    </SafeAreaView>
  );
};

const makeStyles = (t: any) => StyleSheet.create({
  // ── Header ──
  headerSection: {
    backgroundColor: HEADER_COLOR,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 28,
  },
  editIconBtn: {
    alignSelf: 'flex-end',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: HEADER_COLOR,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: 'white',
    marginBottom: 6,
  },
  nameInputHeader: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.5)',
    marginBottom: 6,
    textAlign: 'center',
    minWidth: 160,
    paddingVertical: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  locationText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
  },
  onlineText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },
  joinedText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  photoGalleryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  galleryThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  removeThumbBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 9,
  },
  addThumbBtn: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderStyle: 'dashed',
  },

  // ── Content ──
  content: {
    padding: 16,
    backgroundColor: '#F3F4F6',
  },

  // Stats card
  statsCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    flexDirection: 'row',
    paddingVertical: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNum: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  statLbl: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    textAlign: 'center',
  },
  statSep: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },

  // Action buttons
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  createPostBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#FF1744',
    borderRadius: 12,
    paddingVertical: 13,
  },
  checkInActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 13,
  },
  actionBtnText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },

  // Section
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  addLink: {
    fontSize: 14,
    color: '#FF1744',
    fontWeight: '600',
  },

  // White card
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },

  // Check-in card content
  checkInRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkInIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkInName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  checkInSub: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  liveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  endBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  endBtnText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },

  // About Me
  bioText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
  bioEditInput: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
    textAlignVertical: 'top',
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  editFieldsGroup: {
    gap: 8,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editLabel: {
    fontSize: 13,
    color: '#6B7280',
    width: 70,
  },
  editInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    color: '#1F2937',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  tagText: {
    fontSize: 13,
    color: '#FF1744',
    fontWeight: '500',
  },

  // Posts grid
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  postCell: {
    width: POST_SIZE,
    height: POST_SIZE,
    position: 'relative',
  },
  postImg: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
  },
  postLikeBadge: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  postLikeNum: {
    color: 'white',
    fontSize: 11,
    fontWeight: '500',
  },
  emptyCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 28,
    alignItems: 'center',
  },
  emptyCardText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    marginBottom: 12,
  },
  emptyCardBtn: {
    backgroundColor: '#FF1744',
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 8,
  },
  emptyCardBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },

  // Save button
  saveButton: {
    backgroundColor: '#FF1744',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default ProfileScreen;
