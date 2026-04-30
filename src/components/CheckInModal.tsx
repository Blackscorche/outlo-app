import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { supabase } from '../integrations/supabase/client';
import { Place } from '../hooks/usePlaces';
import { useTheme } from '../contexts/ThemeContext';

// Activity tags for check-in feature
export const ACTIVITY_TAGS = [
  { id: 'coffee', label: 'Coffee & Chat', icon: 'cafe-outline' as const },
  { id: 'study', label: 'Study Session', icon: 'book-outline' as const },
  { id: 'running', label: 'Running/Exercise', icon: 'fitness-outline' as const },
  { id: 'sports', label: 'Sports Activity', icon: 'basketball-outline' as const },
  { id: 'creative', label: 'Creative Meetup', icon: 'color-palette-outline' as const },
  { id: 'dining', label: 'Dining Together', icon: 'restaurant-outline' as const },
  { id: 'music', label: 'Music/Concert', icon: 'musical-notes-outline' as const },
  { id: 'photography', label: 'Photography Walk', icon: 'camera-outline' as const },
  { id: 'yoga', label: 'Yoga/Meditation', icon: 'leaf-outline' as const },
  { id: 'networking', label: 'Networking', icon: 'briefcase-outline' as const },
  { id: 'gaming', label: 'Gaming', icon: 'game-controller-outline' as const },
  { id: 'language', label: 'Language Exchange', icon: 'chatbubbles-outline' as const },
  { id: 'hangout', label: 'Just Hanging Out', icon: 'people-outline' as const },
];

// Helper to get activity tag info by id
export const getActivityTag = (id: string) => ACTIVITY_TAGS.find(tag => tag.id === id);

export interface CheckInSuccessData {
  checkInId: string;
  placeId: string | null;
  locationName: string;
  latitude: number;
  longitude: number;
}

interface CheckInModalProps {
  visible: boolean;
  onClose: () => void;
  onCheckIn: () => void;
  onCheckInSuccess?: (data: CheckInSuccessData) => void;
  currentLocation: Location.LocationObject | null;
}

const CheckInModal = ({ visible, onClose, onCheckIn, onCheckInSuccess, currentLocation }: CheckInModalProps) => {
  const [locationName, setLocationName] = useState('');
  const [description, setDescription] = useState('');
  const [activityTag, setActivityTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    if (visible) {
      getCurrentLocation();
    }
  }, [visible]);

  const getCurrentLocation = async () => {
    try {
      if (currentLocation) {
        setUserLocation({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Location permission is required for check-in');
          return;
        }

        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get your location');
    }
  };

  const createCheckIn = async () => {
    if (!activityTag) {
      Alert.alert('Error', 'Please select an activity');
      return;
    }

    if (!locationName.trim()) {
      Alert.alert('Error', 'Please enter a location name');
      return;
    }

    if (!userLocation) {
      Alert.alert('Error', 'Location not available');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Deactivate previous check-ins
      await supabase
        .from('check_ins')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('is_active', true);

      // Create new check-in
      const { data: checkInData, error } = await supabase
        .from('check_ins')
        .insert({
          user_id: user.id,
          location_name: locationName.trim(),
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          description: description.trim() || null,
          activity_tag: activityTag,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        })
        .select('id')
        .single();

      if (error) throw error;

      // Find or create a place for this location
      let placeId: string | null = null;
      try {
        const threshold = 0.0001; // ~11 meters

        // First try to find existing place
        const { data: existingPlaces } = await supabase
          .from('places')
          .select('id, name')
          .gte('latitude', userLocation.latitude - threshold)
          .lte('latitude', userLocation.latitude + threshold)
          .gte('longitude', userLocation.longitude - threshold)
          .lte('longitude', userLocation.longitude + threshold)
          .limit(5);

        // Check if any existing place matches the name
        const matchingPlace = existingPlaces?.find(p =>
          p.name.toLowerCase() === locationName.trim().toLowerCase()
        );

        if (matchingPlace) {
          placeId = matchingPlace.id;
        } else if (existingPlaces && existingPlaces.length > 0) {
          // If very close place exists, use that
          placeId = existingPlaces[0].id;
        } else {
          // Create new place
          const { data: newPlace } = await supabase
            .from('places')
            .insert({
              name: locationName.trim(),
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
              place_type: 'other',
            })
            .select('id')
            .single();

          placeId = newPlace?.id || null;
        }
      } catch (placeError) {
        console.log('Place creation skipped:', placeError);
      }

      const checkInSuccessData: CheckInSuccessData = {
        checkInId: checkInData.id,
        placeId,
        locationName: locationName.trim(),
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      };

      // Reset form first
      const savedLocationName = locationName.trim();
      setLocationName('');
      setDescription('');
      setActivityTag(null);

      onCheckIn();

      // Call success callback with check-in data
      if (onCheckInSuccess) {
        onCheckInSuccess(checkInSuccessData);
      }
    } catch (error) {
      console.error('Error creating check-in:', error);
      Alert.alert('Error', 'Failed to create check-in');
    } finally {
      setLoading(false);
    }
  };
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Check In</Text>
          <TouchableOpacity onPress={createCheckIn} disabled={loading || !locationName.trim() || !activityTag}>
            <Text style={[styles.doneButton, (!locationName.trim() || !activityTag || loading) && styles.doneButtonDisabled]}>
              {loading ? 'Checking in...' : 'Check In'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.locationInfo}>
            <Ionicons name="location" size={24} color={theme.colors.primary} />
            <Text style={styles.locationText}>
              {userLocation ? 'Location found' : 'Getting location...'}
            </Text>
          </View>

          {/* Activity Tag Selection */}
          <Text style={styles.sectionLabel}>Select Activity *</Text>
          <View style={styles.activityTagsContainer}>
            {ACTIVITY_TAGS.map((tag) => (
              <TouchableOpacity
                key={tag.id}
                style={[
                  styles.activityTag,
                  activityTag === tag.id && styles.activityTagSelected,
                ]}
                onPress={() => setActivityTag(tag.id)}
              >
                <Ionicons
                  name={tag.icon}
                  size={20}
                  color={activityTag === tag.id ? '#fff' : theme.colors.primary}
                />
                <Text
                  style={[
                    styles.activityTagText,
                    activityTag === tag.id && styles.activityTagTextSelected,
                  ]}
                  numberOfLines={1}
                >
                  {tag.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Location Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Starbucks Downtown"
            value={locationName}
            onChangeText={setLocationName}
            maxLength={100}
          />

          <Text style={styles.sectionLabel}>Message (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="What are you up to? Looking for company?"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            maxLength={200}
          />

          <Text style={styles.hint}>
            Your check-in will be visible on the map for 24 hours
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
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
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  title: {
    fontSize: t.fontSize.lg,
    fontWeight: '600',
    color: t.colors.text,
  },
  doneButton: {
    fontSize: t.fontSize.base,
    color: t.colors.primary,
    fontWeight: '600',
  },
  doneButtonDisabled: {
    color: t.colors.textSecondary,
  },
  content: {
    flex: 1,
    padding: t.spacing.lg,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    marginBottom: t.spacing.lg,
    padding: t.spacing.md,
    backgroundColor: t.colors.surface,
    borderRadius: t.borderRadius.md,
  },
  locationText: {
    fontSize: t.fontSize.base,
    color: t.colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.borderRadius.md,
    padding: t.spacing.md,
    fontSize: t.fontSize.base,
    marginBottom: t.spacing.md,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: t.fontSize.sm,
    color: t.colors.textSecondary,
    fontStyle: 'italic',
    marginTop: t.spacing.sm,
  },
  sectionLabel: {
    fontSize: t.fontSize.sm,
    fontWeight: '600',
    color: t.colors.text,
    marginBottom: t.spacing.sm,
    marginTop: t.spacing.sm,
  },
  activityTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.sm,
    marginBottom: t.spacing.lg,
  },
  activityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: t.colors.primary,
    backgroundColor: t.colors.background,
  },
  activityTagSelected: {
    backgroundColor: t.colors.primary,
    borderColor: t.colors.primary,
  },
  activityTagText: {
    fontSize: t.fontSize.sm,
    color: t.colors.primary,
    fontWeight: '500',
  },
  activityTagTextSelected: {
    color: '#fff',
  },
});

export default CheckInModal;