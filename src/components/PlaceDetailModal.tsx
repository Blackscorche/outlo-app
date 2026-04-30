import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppLoading from './AppLoading';
import { Place, PlaceReview, usePlaces } from '../hooks/usePlaces';
import { getPlaceType, getReviewTag, getBestForOption } from '../constants/placeTypes';
import { useTheme } from '../contexts/ThemeContext';

interface PlaceDetailModalProps {
  visible: boolean;
  placeId: string | null;
  onClose: () => void;
  onCheckIn: (place: Place) => void;
  onCreateActivity: (place: Place) => void;
  onWriteReview: (place: Place) => void;
  onViewProfile: (userId: string) => void;
}

const DEFAULT_AVATAR = 'https://ui-avatars.com/api/?background=FF1744&color=fff&size=100';

export default function PlaceDetailModal({
  visible,
  placeId,
  onClose,
  onCheckIn,
  onCreateActivity,
  onWriteReview,
  onViewProfile,
}: PlaceDetailModalProps) {
  const { getPlaceById, markReviewHelpful } = usePlaces();
  const [place, setPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && placeId) {
      loadPlace();
    }
    if (!visible) {
      setPlace(null);
    }
  }, [visible, placeId]);

  const loadPlace = async () => {
    if (!placeId) return;
    setLoading(true);
    const data = await getPlaceById(placeId);
    setPlace(data);
    setLoading(false);
  };

  const handleOpenMaps = () => {
    if (!place) return;
    const url = Platform.select({
      ios: `maps:0,0?q=${place.latitude},${place.longitude}`,
      android: `geo:0,0?q=${place.latitude},${place.longitude}(${encodeURIComponent(place.name)})`,
    });
    if (url) Linking.openURL(url);
  };

  const handleMarkHelpful = async (reviewId: string) => {
    await markReviewHelpful(reviewId);
    await loadPlace(); // Reload to update counts
  };

  const getAvatarUrl = (user?: { name?: string; photos?: string[] | null }) => {
    if (user?.photos && user.photos.length > 0) {
      return user.photos[0];
    }
    return `${DEFAULT_AVATAR}&name=${encodeURIComponent(user?.name || 'User')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : i - rating < 1 ? 'star-half' : 'star-outline'}
          size={16}
          color="#FFD700"
        />
      );
    }
    return stars;
  };

  const placeType = place ? getPlaceType(place.place_type) : null;
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Place Details</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <AppLoading />
          </View>
        ) : place ? (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Place Header */}
            <View style={styles.placeHeader}>
              <View style={styles.placeIconContainer}>
                <Ionicons
                  name={(placeType?.icon || 'location-outline') as any}
                  size={32}
                  color={theme.colors.primary}
                />
              </View>
              <View style={styles.placeInfo}>
                <Text style={styles.placeName}>{place.name}</Text>
                <Text style={styles.placeType}>{placeType?.label || 'Place'}</Text>
                {place.address && (
                  <Text style={styles.placeAddress} numberOfLines={2}>
                    {place.address}
                  </Text>
                )}
              </View>
            </View>

            {/* Rating Section */}
            <View style={styles.ratingSection}>
              <View style={styles.ratingMain}>
                <Text style={styles.ratingNumber}>
                  {place.average_rating > 0 ? place.average_rating.toFixed(1) : '-'}
                </Text>
                <View style={styles.starsContainer}>
                  {renderStars(place.average_rating)}
                </View>
                <Text style={styles.reviewCount}>
                  ({place.review_count} {place.review_count === 1 ? 'review' : 'reviews'})
                </Text>
              </View>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Ionicons name="people" size={20} color={theme.colors.primary} />
                <Text style={styles.statNumber}>{place.recent_check_ins || 0}</Text>
                <Text style={styles.statLabel}>Checked in</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Ionicons name="calendar" size={20} color={theme.colors.success} />
                <Text style={styles.statNumber}>{place.nearby_activities || 0}</Text>
                <Text style={styles.statLabel}>Activities</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Ionicons name="star" size={20} color="#FFD700" />
                <Text style={styles.statNumber}>{place.review_count || 0}</Text>
                <Text style={styles.statLabel}>Reviews</Text>
              </View>
            </View>

            {/* Tags */}
            {place.tags && place.tags.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Tags</Text>
                <View style={styles.tagsContainer}>
                  {place.tags.map((tagId, index) => {
                    const tag = getReviewTag(tagId);
                    return (
                      <View key={index} style={styles.tag}>
                        <Text style={styles.tagText}>#{tag?.label || tagId}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Reviews */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Reviews</Text>
                <TouchableOpacity onPress={() => onWriteReview(place)}>
                  <Text style={styles.writeReviewLink}>Write a review</Text>
                </TouchableOpacity>
              </View>

              {place.reviews && place.reviews.length > 0 ? (
                place.reviews.map((review) => (
                  <View key={review.id} style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                      <TouchableOpacity
                        style={styles.reviewUser}
                        onPress={() => onViewProfile(review.user_id)}
                      >
                        <Image
                          source={{ uri: getAvatarUrl(review.user) }}
                          style={styles.reviewAvatar}
                        />
                        <View>
                          <Text style={styles.reviewUserName}>
                            {review.user?.name || 'User'}
                          </Text>
                          <Text style={styles.reviewDate}>
                            {formatDate(review.created_at)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      <View style={styles.reviewRating}>
                        {renderStars(review.rating)}
                      </View>
                    </View>

                    {review.review_text && (
                      <Text style={styles.reviewText}>{review.review_text}</Text>
                    )}

                    {/* Review Tags */}
                    {review.tags && Object.keys(review.tags).filter(k => review.tags[k]).length > 0 && (
                      <View style={styles.reviewTags}>
                        {Object.entries(review.tags)
                          .filter(([_, value]) => value)
                          .map(([key]) => {
                            const tag = getReviewTag(key);
                            return (
                              <View key={key} style={styles.reviewTag}>
                                <Text style={styles.reviewTagText}>
                                  {tag?.label || key}
                                </Text>
                              </View>
                            );
                          })}
                      </View>
                    )}

                    {/* Best For */}
                    {review.best_for && review.best_for.length > 0 && (
                      <View style={styles.bestForContainer}>
                        <Text style={styles.bestForLabel}>Best for: </Text>
                        {review.best_for.map((id, idx) => {
                          const option = getBestForOption(id);
                          return (
                            <Text key={id} style={styles.bestForItem}>
                              {option?.label || id}
                              {idx < review.best_for.length - 1 ? ', ' : ''}
                            </Text>
                          );
                        })}
                      </View>
                    )}

                    {/* Helpful */}
                    <TouchableOpacity
                      style={styles.helpfulButton}
                      onPress={() => handleMarkHelpful(review.id)}
                    >
                      <Ionicons
                        name={review.has_marked_helpful ? 'thumbs-up' : 'thumbs-up-outline'}
                        size={16}
                        color={review.has_marked_helpful ? theme.colors.primary : theme.colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.helpfulText,
                          review.has_marked_helpful && styles.helpfulTextActive,
                        ]}
                      >
                        Helpful ({review.helpful_count})
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <View style={styles.noReviews}>
                  <Ionicons
                    name="chatbubble-outline"
                    size={32}
                    color={theme.colors.gray[300]}
                  />
                  <Text style={styles.noReviewsText}>No reviews yet</Text>
                  <Text style={styles.noReviewsSubtext}>
                    Be the first to share your experience!
                  </Text>
                </View>
              )}
            </View>

            {/* Spacer for action buttons */}
            <View style={{ height: 120 }} />
          </ScrollView>
        ) : (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={theme.colors.gray[300]} />
            <Text style={styles.errorText}>Place not found</Text>
          </View>
        )}

        {/* Action Buttons */}
        {place && (
          <View style={styles.actionContainer}>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleOpenMaps}
              >
                <Ionicons name="navigate-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.actionButtonText}>Directions</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonPrimary]}
                onPress={() => onCheckIn(place)}
              >
                <Ionicons name="location" size={20} color="white" />
                <Text style={styles.actionButtonTextPrimary}>Check In</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => onCreateActivity(place)}
              >
                <Ionicons name="calendar-outline" size={20} color={theme.colors.success} />
                <Text style={[styles.actionButtonText, { color: theme.colors.success }]}>
                  Activity
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
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
    paddingVertical: t.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  closeButton: {
    padding: t.spacing.sm,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: t.colors.text,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: t.spacing.xl,
  },
  errorText: {
    fontSize: 16,
    color: t.colors.textSecondary,
    marginTop: t.spacing.md,
  },
  placeHeader: {
    flexDirection: 'row',
    padding: t.spacing.lg,
    backgroundColor: t.colors.surface,
    gap: t.spacing.md,
  },
  placeIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: t.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: 22,
    fontWeight: '700',
    color: t.colors.text,
    marginBottom: 4,
  },
  placeType: {
    fontSize: 14,
    color: t.colors.primary,
    fontWeight: '500',
    marginBottom: 4,
  },
  placeAddress: {
    fontSize: 13,
    color: t.colors.textSecondary,
    lineHeight: 18,
  },
  ratingSection: {
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
    backgroundColor: t.colors.surface,
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
  },
  ratingMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  ratingNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: t.colors.text,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewCount: {
    fontSize: 14,
    color: t.colors.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: t.spacing.lg,
    backgroundColor: t.colors.surface,
    marginTop: t.spacing.sm,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: t.colors.text,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: t.colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: t.colors.border,
  },
  section: {
    padding: t.spacing.lg,
    backgroundColor: t.colors.surface,
    marginTop: t.spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: t.spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: t.colors.text,
  },
  writeReviewLink: {
    fontSize: 14,
    color: t.colors.primary,
    fontWeight: '500',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.sm,
    marginTop: t.spacing.sm,
  },
  tag: {
    backgroundColor: t.colors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 13,
    color: t.colors.primary,
    fontWeight: '500',
  },
  reviewCard: {
    backgroundColor: t.colors.background,
    borderRadius: t.borderRadius.md,
    padding: t.spacing.md,
    marginBottom: t.spacing.md,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: t.spacing.sm,
  },
  reviewUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  reviewUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: t.colors.text,
  },
  reviewDate: {
    fontSize: 12,
    color: t.colors.textSecondary,
  },
  reviewRating: {
    flexDirection: 'row',
  },
  reviewText: {
    fontSize: 14,
    color: t.colors.text,
    lineHeight: 20,
    marginBottom: t.spacing.sm,
  },
  reviewTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: t.spacing.sm,
  },
  reviewTag: {
    backgroundColor: t.colors.gray[100],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  reviewTagText: {
    fontSize: 11,
    color: t.colors.textSecondary,
  },
  bestForContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: t.spacing.sm,
  },
  bestForLabel: {
    fontSize: 12,
    color: t.colors.textSecondary,
    fontWeight: '500',
  },
  bestForItem: {
    fontSize: 12,
    color: t.colors.text,
  },
  helpfulButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: t.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
  },
  helpfulText: {
    fontSize: 13,
    color: t.colors.textSecondary,
  },
  helpfulTextActive: {
    color: t.colors.primary,
  },
  noReviews: {
    alignItems: 'center',
    padding: t.spacing.xl,
  },
  noReviewsText: {
    fontSize: 16,
    fontWeight: '500',
    color: t.colors.textSecondary,
    marginTop: t.spacing.md,
  },
  noReviewsSubtext: {
    fontSize: 14,
    color: t.colors.textSecondary,
    marginTop: 4,
  },
  actionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: t.spacing.md,
    paddingBottom: t.spacing.lg,
    backgroundColor: t.colors.surface,
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: t.spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: t.spacing.md,
    borderRadius: t.borderRadius.lg,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    gap: 6,
  },
  actionButtonPrimary: {
    backgroundColor: t.colors.primary,
    borderColor: t.colors.primary,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: t.colors.primary,
  },
  actionButtonTextPrimary: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
});
