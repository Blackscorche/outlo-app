import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { Place, PlaceReview, usePlaces } from '../hooks/usePlaces';
import { REVIEW_TAGS, BEST_FOR_OPTIONS, getPlaceType } from '../constants/placeTypes';

interface PlaceReviewModalProps {
  visible: boolean;
  place: Place | null;
  checkInId?: string; // Optional link to check-in
  existingReview?: PlaceReview | null;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function PlaceReviewModal({
  visible,
  place,
  checkInId,
  existingReview,
  onClose,
  onSubmitted,
}: PlaceReviewModalProps) {
  const { createReview, getUserReview } = usePlaces();
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [selectedTags, setSelectedTags] = useState<Record<string, boolean>>({});
  const [selectedBestFor, setSelectedBestFor] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && place) {
      loadExistingReview();
    }
    if (!visible) {
      resetForm();
    }
  }, [visible, place?.id]);

  useEffect(() => {
    if (existingReview) {
      setRating(existingReview.rating);
      setReviewText(existingReview.review_text || '');
      setSelectedTags(existingReview.tags || {});
      setSelectedBestFor(existingReview.best_for || []);
    }
  }, [existingReview]);

  const loadExistingReview = async () => {
    if (!place) return;
    setLoading(true);
    const review = await getUserReview(place.id);
    if (review) {
      setRating(review.rating);
      setReviewText(review.review_text || '');
      setSelectedTags(review.tags || {});
      setSelectedBestFor(review.best_for || []);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setRating(0);
    setReviewText('');
    setSelectedTags({});
    setSelectedBestFor([]);
  };

  const handleToggleTag = (tagId: string) => {
    setSelectedTags(prev => ({
      ...prev,
      [tagId]: !prev[tagId],
    }));
  };

  const handleToggleBestFor = (optionId: string) => {
    setSelectedBestFor(prev =>
      prev.includes(optionId)
        ? prev.filter(id => id !== optionId)
        : [...prev, optionId]
    );
  };

  const handleSubmit = async () => {
    if (!place) return;

    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a rating before submitting.');
      return;
    }

    setSubmitting(true);
    const success = await createReview({
      place_id: place.id,
      rating,
      review_text: reviewText.trim() || undefined,
      tags: selectedTags,
      best_for: selectedBestFor,
      check_in_id: checkInId,
    });

    if (success) {
      onSubmitted();
      onClose();
    }
    setSubmitting(false);
  };

  const placeType = place ? getPlaceType(place.place_type) : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Write a Review</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : place ? (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Place Info */}
            <View style={styles.placeInfo}>
              <View style={styles.placeIconContainer}>
                <Ionicons
                  name={(placeType?.icon || 'location-outline') as any}
                  size={24}
                  color={theme.colors.primary}
                />
              </View>
              <Text style={styles.placeName}>{place.name}</Text>
            </View>

            {/* Rating */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Rating</Text>
              <View style={styles.ratingContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setRating(star)}
                    style={styles.starButton}
                  >
                    <Ionicons
                      name={star <= rating ? 'star' : 'star-outline'}
                      size={40}
                      color={star <= rating ? '#FFD700' : theme.colors.gray[300]}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.ratingLabel}>
                {rating === 0
                  ? 'Tap to rate'
                  : rating === 1
                  ? 'Poor'
                  : rating === 2
                  ? 'Fair'
                  : rating === 3
                  ? 'Good'
                  : rating === 4
                  ? 'Very Good'
                  : 'Excellent'}
              </Text>
            </View>

            {/* Tags */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tags (select all that apply)</Text>
              <View style={styles.tagsGrid}>
                {REVIEW_TAGS.map((tag) => (
                  <TouchableOpacity
                    key={tag.id}
                    style={[
                      styles.tagButton,
                      selectedTags[tag.id] && styles.tagButtonActive,
                    ]}
                    onPress={() => handleToggleTag(tag.id)}
                  >
                    <Ionicons
                      name={selectedTags[tag.id] ? 'checkbox' : 'square-outline'}
                      size={18}
                      color={selectedTags[tag.id] ? theme.colors.primary : theme.colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.tagButtonText,
                        selectedTags[tag.id] && styles.tagButtonTextActive,
                      ]}
                    >
                      {tag.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Review Text */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Review (optional)</Text>
              <TextInput
                style={styles.reviewInput}
                placeholder="Share your experience..."
                placeholderTextColor={theme.colors.textSecondary}
                value={reviewText}
                onChangeText={setReviewText}
                multiline
                numberOfLines={4}
                maxLength={500}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{reviewText.length}/500</Text>
            </View>

            {/* Best For */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Best for</Text>
              <View style={styles.bestForGrid}>
                {BEST_FOR_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.bestForButton,
                      selectedBestFor.includes(option.id) && styles.bestForButtonActive,
                    ]}
                    onPress={() => handleToggleBestFor(option.id)}
                  >
                    <Ionicons
                      name={option.icon as any}
                      size={20}
                      color={
                        selectedBestFor.includes(option.id)
                          ? theme.colors.primary
                          : theme.colors.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.bestForButtonText,
                        selectedBestFor.includes(option.id) && styles.bestForButtonTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Spacer */}
            <View style={{ height: 100 }} />
          </ScrollView>
        ) : null}

        {/* Submit Button */}
        <View style={styles.submitContainer}>
          <TouchableOpacity
            style={[styles.submitButton, rating === 0 && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting || rating === 0}
          >
            {submitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Review</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  closeButton: {
    padding: theme.spacing.sm,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  placeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    gap: theme.spacing.md,
  },
  placeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  section: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    marginTop: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  starButton: {
    padding: theme.spacing.xs,
  },
  ratingLabel: {
    textAlign: 'center',
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
  },
  tagsGrid: {
    gap: theme.spacing.sm,
  },
  tagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  tagButtonActive: {},
  tagButtonText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  tagButtonTextActive: {
    color: theme.colors.text,
    fontWeight: '500',
  },
  reviewInput: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.text,
    minHeight: 120,
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  bestForGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  bestForButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    gap: 6,
  },
  bestForButtonActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '10',
  },
  bestForButtonText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  bestForButtonTextActive: {
    color: theme.colors.primary,
    fontWeight: '500',
  },
  submitContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: theme.colors.gray[300],
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
