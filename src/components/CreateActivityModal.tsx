import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import * as Location from 'expo-location';
import { theme } from '../styles/theme';
import { ACTIVITY_TYPES } from '../constants/activityTypes';
import { useActivities } from '../hooks/useActivities';

interface CreateActivityModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateActivityModal({
  visible,
  onClose,
  onCreated,
}: CreateActivityModalProps) {
  const { createActivity } = useActivities();

  const [activityType, setActivityType] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [scheduledDate, setScheduledDate] = useState(new Date());
  const [maxParticipants, setMaxParticipants] = useState(5);
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  // Date/Time picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');

  useEffect(() => {
    if (visible) {
      // Set default date to 1 hour from now
      const defaultDate = new Date();
      defaultDate.setHours(defaultDate.getHours() + 1);
      defaultDate.setMinutes(0);
      setScheduledDate(defaultDate);
    }
  }, [visible]);

  const resetForm = () => {
    setActivityType(null);
    setTitle('');
    setDescription('');
    setLocationName('');
    setLatitude(null);
    setLongitude(null);
    setMaxParticipants(5);
    const defaultDate = new Date();
    defaultDate.setHours(defaultDate.getHours() + 1);
    setScheduledDate(defaultDate);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const getCurrentLocation = async () => {
    try {
      setGettingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setLatitude(location.coords.latitude);
      setLongitude(location.coords.longitude);

      // Try to get address
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (address) {
        const parts = [];
        if (address.name) parts.push(address.name);
        if (address.street) parts.push(address.street);
        if (address.city) parts.push(address.city);
        setLocationName(parts.join(', ') || 'Current Location');
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get your location');
    } finally {
      setGettingLocation(false);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      setShowTimePicker(false);
    }

    if (selectedDate) {
      if (pickerMode === 'date') {
        const newDate = new Date(scheduledDate);
        newDate.setFullYear(selectedDate.getFullYear());
        newDate.setMonth(selectedDate.getMonth());
        newDate.setDate(selectedDate.getDate());
        setScheduledDate(newDate);

        if (Platform.OS === 'android') {
          // Show time picker after date selection on Android
          setTimeout(() => {
            setPickerMode('time');
            setShowTimePicker(true);
          }, 100);
        }
      } else {
        const newDate = new Date(scheduledDate);
        newDate.setHours(selectedDate.getHours());
        newDate.setMinutes(selectedDate.getMinutes());
        setScheduledDate(newDate);
      }
    }
  };

  const showDateTimePicker = () => {
    setPickerMode('date');
    if (Platform.OS === 'ios') {
      setShowDatePicker(true);
    } else {
      setShowDatePicker(true);
    }
  };

  const validateForm = (): boolean => {
    if (!activityType) {
      Alert.alert('Error', 'Please select an activity type');
      return false;
    }
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return false;
    }
    if (!locationName.trim() || latitude === null || longitude === null) {
      Alert.alert('Error', 'Please set a location');
      return false;
    }
    if (scheduledDate <= new Date()) {
      Alert.alert('Error', 'Please select a future date and time');
      return false;
    }
    return true;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const success = await createActivity({
        activity_type: activityType!,
        title: title.trim(),
        description: description.trim() || undefined,
        location_name: locationName.trim(),
        latitude: latitude!,
        longitude: longitude!,
        scheduled_at: scheduledDate.toISOString(),
        max_participants: maxParticipants,
      });

      if (success) {
        Alert.alert('Success', 'Activity created successfully!');
        resetForm();
        onCreated();
      }
    } catch (error) {
      console.error('Error creating activity:', error);
      Alert.alert('Error', 'Failed to create activity');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Activity</Text>
          <TouchableOpacity
            onPress={handleCreate}
            disabled={loading}
          >
            <Text
              style={[
                styles.createButtonText,
                loading && styles.createButtonTextDisabled,
              ]}
            >
              {loading ? 'Creating...' : 'Create'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Activity Type Selection */}
          <Text style={styles.sectionLabel}>Activity Type *</Text>
          <View style={styles.activityTypesContainer}>
            {ACTIVITY_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.activityTypeChip,
                  activityType === type.id && styles.activityTypeChipSelected,
                ]}
                onPress={() => setActivityType(type.id)}
              >
                <Ionicons
                  name={type.icon}
                  size={18}
                  color={activityType === type.id ? 'white' : theme.colors.primary}
                />
                <Text
                  style={[
                    styles.activityTypeText,
                    activityType === type.id && styles.activityTypeTextSelected,
                  ]}
                  numberOfLines={1}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Title */}
          <Text style={styles.sectionLabel}>Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Sunday morning coffee at Starbucks"
            value={title}
            onChangeText={setTitle}
            maxLength={200}
          />

          {/* Description */}
          <Text style={styles.sectionLabel}>Description (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Tell others what you're planning..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            maxLength={500}
          />

          {/* Location */}
          <Text style={styles.sectionLabel}>Location *</Text>
          <View style={styles.locationContainer}>
            <TouchableOpacity
              style={styles.locationButton}
              onPress={getCurrentLocation}
              disabled={gettingLocation}
            >
              {gettingLocation ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Ionicons name="locate" size={20} color={theme.colors.primary} />
              )}
              <Text style={styles.locationButtonText}>
                {gettingLocation ? 'Getting location...' : 'Use Current Location'}
              </Text>
            </TouchableOpacity>

            {latitude && longitude && (
              <View style={styles.locationInfo}>
                <Ionicons name="location" size={16} color={theme.colors.success} />
                <Text style={styles.locationInfoText}>Location set</Text>
              </View>
            )}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Location name (e.g., Starbucks Gangnam)"
            value={locationName}
            onChangeText={setLocationName}
            maxLength={200}
          />

          {/* Date & Time */}
          <Text style={styles.sectionLabel}>Date & Time *</Text>
          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={showDateTimePicker}
          >
            <Ionicons name="calendar" size={20} color={theme.colors.primary} />
            <Text style={styles.dateTimeText}>
              {formatDateTime(scheduledDate)}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          {/* Date/Time Picker */}
          {(showDatePicker || showTimePicker) && (
            <DateTimePicker
              value={scheduledDate}
              mode={pickerMode}
              is24Hour={true}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              minimumDate={new Date()}
            />
          )}

          {Platform.OS === 'ios' && showDatePicker && (
            <View style={styles.iosPickerButtons}>
              <TouchableOpacity
                onPress={() => {
                  if (pickerMode === 'date') {
                    setPickerMode('time');
                  } else {
                    setShowDatePicker(false);
                  }
                }}
                style={styles.iosPickerButton}
              >
                <Text style={styles.iosPickerButtonText}>
                  {pickerMode === 'date' ? 'Next: Select Time' : 'Done'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Max Participants */}
          <Text style={styles.sectionLabel}>
            Max Participants: {maxParticipants} people
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={2}
            maximumValue={20}
            step={1}
            value={maxParticipants}
            onValueChange={setMaxParticipants}
            minimumTrackTintColor={theme.colors.primary}
            maximumTrackTintColor={theme.colors.gray[300]}
          />
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderLabel}>2</Text>
            <Text style={styles.sliderLabel}>20</Text>
          </View>

          {/* Info Note */}
          <View style={styles.infoNote}>
            <Ionicons name="information-circle" size={20} color={theme.colors.info} />
            <Text style={styles.infoNoteText}>
              You will be automatically added as the first participant.
            </Text>
          </View>

          {/* Spacer for bottom padding */}
          <View style={{ height: 50 }} />
        </ScrollView>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

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
    backgroundColor: theme.colors.surface,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  createButtonTextDisabled: {
    color: theme.colors.textSecondary,
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  activityTypesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  activityTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: 'transparent',
    gap: 6,
  },
  activityTypeChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  activityTypeText: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  activityTypeTextSelected: {
    color: 'white',
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.md,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary + '15',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
  },
  locationButtonText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationInfoText: {
    fontSize: 14,
    color: theme.colors.success,
    fontWeight: '500',
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    gap: theme.spacing.sm,
  },
  dateTimeText: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
  },
  iosPickerButtons: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  iosPickerButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  iosPickerButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  slider: {
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -8,
  },
  sliderLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.info + '15',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  infoNoteText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.info,
    lineHeight: 18,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
