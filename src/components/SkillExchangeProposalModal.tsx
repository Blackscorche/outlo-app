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
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { Tables } from '../integrations/supabase/types';
import { useSkillExchange } from '../hooks/useSkillExchange';
import { SkillLevelBadge } from './SkillBadgeDisplay';
import { useTheme } from '../contexts/ThemeContext';

const DEFAULT_AVATAR = 'https://ui-avatars.com/api/?background=FF1744&color=fff&size=100';

interface SkillExchangeProposalModalProps {
  visible: boolean;
  onClose: () => void;
  receiver?: {
    id: string;
    name: string;
    photos?: string[] | null;
  };
  receiverSkills: (Tables<'user_skills'> & {
    skill?: Tables<'skills'>;
  })[];
  mySkills: (Tables<'user_skills'> & {
    skill?: Tables<'skills'>;
  })[];
  onProposed: () => void;
}

export default function SkillExchangeProposalModal({
  visible,
  onClose,
  receiver,
  receiverSkills,
  mySkills,
  onProposed,
}: SkillExchangeProposalModalProps) {
  const { createProposal } = useSkillExchange();

  const [selectedSkillToLearn, setSelectedSkillToLearn] = useState<string | null>(null);
  const [selectedSkillToOffer, setSelectedSkillToOffer] = useState<string | null>(null);
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [proposedDate, setProposedDate] = useState(new Date());
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  // Date/Time picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    if (visible) {
      resetForm();
      // Set default date to tomorrow at 2pm
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 1);
      defaultDate.setHours(14, 0, 0, 0);
      setProposedDate(defaultDate);
    }
  }, [visible]);

  const resetForm = () => {
    setSelectedSkillToLearn(null);
    setSelectedSkillToOffer(null);
    setLocationName('');
    setLatitude(null);
    setLongitude(null);
    setMessage('');
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
        if (address.name && !address.name.match(/^\d+$/)) {
          parts.push(address.name);
        }
        if (address.street) parts.push(address.street);
        if (address.city) parts.push(address.city);
        setLocationName(parts.join(', ') || 'Current Location');
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get your current location');
    } finally {
      setGettingLocation(false);
    }
  };

  const handleSubmit = async () => {
    if (!receiver) return;

    if (!selectedSkillToLearn) {
      Alert.alert('Error', 'Please select a skill you want to learn');
      return;
    }

    if (!locationName || !latitude || !longitude) {
      Alert.alert('Error', 'Please set a meeting location');
      return;
    }

    if (proposedDate < new Date()) {
      Alert.alert('Error', 'Please select a future date and time');
      return;
    }

    setLoading(true);
    try {
      const success = await createProposal({
        receiver_id: receiver.id,
        skill_to_learn_id: selectedSkillToLearn,
        skill_to_offer_id: selectedSkillToOffer || undefined,
        location_name: locationName,
        latitude,
        longitude,
        proposed_date: proposedDate.toISOString(),
        message: message.trim() || undefined,
      });

      if (success) {
        Alert.alert(
          'Proposal Sent!',
          `Your skill exchange proposal has been sent to ${receiver.name}. You'll be notified when they respond.`,
          [{ text: 'OK', onPress: onProposed }]
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const getReceiverAvatar = () => {
    if (receiver?.photos && receiver.photos.length > 0) {
      return receiver.photos[0];
    }
    return `${DEFAULT_AVATAR}&name=${encodeURIComponent(receiver?.name || 'User')}`;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!receiver) return null;
  const { theme } = useTheme();
  const styles = makeStyles(theme);

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
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Propose Exchange</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Receiver Info */}
          <View style={styles.receiverCard}>
            <Image source={{ uri: getReceiverAvatar() }} style={styles.receiverAvatar} />
            <View>
              <Text style={styles.receiverName}>{receiver.name}</Text>
              <Text style={styles.proposingTo}>Proposing skill exchange</Text>
            </View>
          </View>

          {/* Skill to Learn */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="school" size={16} color={theme.colors.success} /> Skill I want to learn
            </Text>
            <View style={styles.skillOptions}>
              {receiverSkills.map((skill) => (
                <TouchableOpacity
                  key={skill.id}
                  style={[
                    styles.skillOption,
                    selectedSkillToLearn === skill.skill_id && styles.skillOptionSelected,
                  ]}
                  onPress={() => setSelectedSkillToLearn(skill.skill_id)}
                >
                  <Ionicons
                    name={(skill.skill?.icon || 'star-outline') as any}
                    size={18}
                    color={
                      selectedSkillToLearn === skill.skill_id
                        ? theme.colors.primary
                        : theme.colors.text
                    }
                  />
                  <Text
                    style={[
                      styles.skillOptionText,
                      selectedSkillToLearn === skill.skill_id && styles.skillOptionTextSelected,
                    ]}
                  >
                    {skill.skill?.name}
                  </Text>
                  <SkillLevelBadge level={skill.level} size="small" />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Skill to Offer (optional) */}
          {mySkills.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="gift" size={16} color="#2196F3" /> Skill I can offer in exchange (optional)
              </Text>
              <View style={styles.skillOptions}>
                <TouchableOpacity
                  style={[
                    styles.skillOption,
                    selectedSkillToOffer === null && styles.skillOptionSelected,
                  ]}
                  onPress={() => setSelectedSkillToOffer(null)}
                >
                  <Text
                    style={[
                      styles.skillOptionText,
                      selectedSkillToOffer === null && styles.skillOptionTextSelected,
                    ]}
                  >
                    No exchange (just request lesson)
                  </Text>
                </TouchableOpacity>
                {mySkills.map((skill) => (
                  <TouchableOpacity
                    key={skill.id}
                    style={[
                      styles.skillOption,
                      selectedSkillToOffer === skill.skill_id && styles.skillOptionSelected,
                    ]}
                    onPress={() => setSelectedSkillToOffer(skill.skill_id)}
                  >
                    <Ionicons
                      name={(skill.skill?.icon || 'star-outline') as any}
                      size={18}
                      color={
                        selectedSkillToOffer === skill.skill_id
                          ? theme.colors.primary
                          : theme.colors.text
                      }
                    />
                    <Text
                      style={[
                        styles.skillOptionText,
                        selectedSkillToOffer === skill.skill_id && styles.skillOptionTextSelected,
                      ]}
                    >
                      {skill.skill?.name}
                    </Text>
                    <SkillLevelBadge level={skill.level} size="small" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Location */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="location" size={16} color={theme.colors.primary} /> Meeting Location
            </Text>
            <View style={styles.locationRow}>
              <TextInput
                style={styles.locationInput}
                placeholder="e.g., Central Park Cafe"
                placeholderTextColor={theme.colors.textSecondary}
                value={locationName}
                onChangeText={setLocationName}
              />
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
              </TouchableOpacity>
            </View>
          </View>

          {/* Date & Time */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="calendar" size={16} color={theme.colors.primary} /> Proposed Date & Time
            </Text>
            <View style={styles.dateTimeRow}>
              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={18} color={theme.colors.text} />
                <Text style={styles.dateTimeText}>{formatDate(proposedDate)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={() => setShowTimePicker(true)}
              >
                <Ionicons name="time-outline" size={18} color={theme.colors.text} />
                <Text style={styles.dateTimeText}>{formatTime(proposedDate)}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Message */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="chatbubble" size={16} color={theme.colors.primary} /> Message (optional)
            </Text>
            <TextInput
              style={styles.messageInput}
              placeholder="Introduce yourself and explain what you'd like to learn..."
              placeholderTextColor={theme.colors.textSecondary}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
              maxLength={500}
            />
            <Text style={styles.charCount}>{message.length}/500</Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="paper-plane" size={20} color="white" />
                <Text style={styles.submitButtonText}>Send Proposal</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>

        {/* Date Picker */}
        {showDatePicker && (
          <DateTimePicker
            value={proposedDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={new Date()}
            onChange={(event, date) => {
              setShowDatePicker(false);
              if (date) {
                const newDate = new Date(proposedDate);
                newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                setProposedDate(newDate);
              }
            }}
          />
        )}

        {/* Time Picker */}
        {showTimePicker && (
          <DateTimePicker
            value={proposedDate}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, date) => {
              setShowTimePicker(false);
              if (date) {
                const newDate = new Date(proposedDate);
                newDate.setHours(date.getHours(), date.getMinutes());
                setProposedDate(newDate);
              }
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const makeStyles = (t: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  closeButton: {
    padding: t.spacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: t.colors.text,
  },
  headerRight: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: t.spacing.lg,
  },
  receiverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.colors.surface,
    padding: t.spacing.md,
    borderRadius: t.borderRadius.md,
    marginBottom: t.spacing.lg,
    gap: t.spacing.md,
  },
  receiverAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: t.colors.primary + '30',
  },
  receiverName: {
    fontSize: 18,
    fontWeight: '600',
    color: t.colors.text,
  },
  proposingTo: {
    fontSize: 13,
    color: t.colors.textSecondary,
  },
  section: {
    marginBottom: t.spacing.lg,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: t.colors.text,
    marginBottom: t.spacing.sm,
  },
  skillOptions: {
    gap: t.spacing.sm,
  },
  skillOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.colors.surface,
    padding: t.spacing.md,
    borderRadius: t.borderRadius.md,
    borderWidth: 2,
    borderColor: t.colors.border,
    gap: 10,
  },
  skillOptionSelected: {
    borderColor: t.colors.primary,
    backgroundColor: t.colors.primary + '10',
  },
  skillOptionText: {
    flex: 1,
    fontSize: 15,
    color: t.colors.text,
    fontWeight: '500',
  },
  skillOptionTextSelected: {
    color: t.colors.primary,
  },
  locationRow: {
    flexDirection: 'row',
    gap: t.spacing.sm,
  },
  locationInput: {
    flex: 1,
    backgroundColor: t.colors.surface,
    borderRadius: t.borderRadius.md,
    padding: t.spacing.md,
    fontSize: 15,
    color: t.colors.text,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  locationButton: {
    width: 48,
    height: 48,
    borderRadius: t.borderRadius.md,
    backgroundColor: t.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: t.spacing.sm,
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.colors.surface,
    padding: t.spacing.md,
    borderRadius: t.borderRadius.md,
    borderWidth: 1,
    borderColor: t.colors.border,
    gap: 8,
  },
  dateTimeText: {
    fontSize: 15,
    color: t.colors.text,
    fontWeight: '500',
  },
  messageInput: {
    backgroundColor: t.colors.surface,
    borderRadius: t.borderRadius.md,
    padding: t.spacing.md,
    fontSize: 15,
    color: t.colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  charCount: {
    fontSize: 12,
    color: t.colors.textSecondary,
    textAlign: 'right',
    marginTop: 4,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.primary,
    padding: 16,
    borderRadius: t.borderRadius.md,
    marginTop: t.spacing.md,
    marginBottom: t.spacing.xl,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
