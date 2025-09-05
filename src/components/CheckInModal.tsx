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
import { theme } from '../styles/theme';
import { supabase } from '../integrations/supabase/client';

interface CheckInModalProps {
  visible: boolean;
  onClose: () => void;
  onCheckIn: () => void;
  currentLocation: Location.LocationObject | null;
}

const CheckInModal = ({ visible, onClose, onCheckIn, currentLocation }: CheckInModalProps) => {
  const [locationName, setLocationName] = useState('');
  const [description, setDescription] = useState('');
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
      const { error } = await supabase
        .from('check_ins')
        .insert({
          user_id: user.id,
          location_name: locationName.trim(),
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          description: description.trim() || null,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        });

      if (error) throw error;

      Alert.alert('Success', 'Checked in successfully!');
      onCheckIn();
      
      // Reset form
      setLocationName('');
      setDescription('');
    } catch (error) {
      console.error('Error creating check-in:', error);
      Alert.alert('Error', 'Failed to create check-in');
    } finally {
      setLoading(false);
    }
  };

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
          <TouchableOpacity onPress={createCheckIn} disabled={loading || !locationName.trim()}>
            <Text style={[styles.doneButton, (!locationName.trim() || loading) && styles.doneButtonDisabled]}>
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

          <TextInput
            style={styles.input}
            placeholder="Location name (e.g., Starbucks Downtown)"
            value={locationName}
            onChangeText={setLocationName}
            maxLength={100}
          />

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="What are you up to? (e.g., Welcome for a coffee!)"
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text,
  },
  doneButton: {
    fontSize: theme.fontSize.base,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  doneButtonDisabled: {
    color: theme.colors.textSecondary,
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
  },
  locationText: {
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.base,
    marginBottom: theme.spacing.md,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    marginTop: theme.spacing.sm,
  },
});

export default CheckInModal;