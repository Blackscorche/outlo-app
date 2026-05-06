import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Linking,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Activity, ActivityComment } from '../hooks/useActivities';
import { getActivityType } from '../constants/activityTypes';
import OutloLogo from './OutloLogo';
import { useTheme } from '../contexts/ThemeContext';

interface ActivityDetailModalProps {
  visible: boolean;
  activity: Activity | null;
  currentUserId?: string;
  onClose: () => void;
  onJoin: () => void;
  onViewProfile: (userId: string) => void;
  onComplete?: () => void;
  onCancel?: () => void;
  fetchComments?: (activityId: string) => Promise<ActivityComment[]>;
  addComment?: (activityId: string, content: string) => Promise<boolean>;
  deleteComment?: (commentId: string) => Promise<boolean>;
}

const DEFAULT_AVATAR = 'https://ui-avatars.com/api/?background=FF1744&color=fff&size=100';

export default function ActivityDetailModal({
  visible,
  activity,
  currentUserId,
  onClose,
  onJoin,
  onViewProfile,
  onComplete,
  onCancel,
  fetchComments,
  addComment,
  deleteComment,
}: ActivityDetailModalProps) {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const styles = makeStyles(theme);
  const [comments, setComments] = useState<ActivityComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible && activity && fetchComments) {
      loadComments();
    }
    if (!visible) {
      setComments([]);
      setNewComment('');
    }
  }, [visible, activity?.id]);

  const loadComments = async () => {
    if (!activity || !fetchComments) return;
    setCommentsLoading(true);
    const data = await fetchComments(activity.id);
    setComments(data);
    setCommentsLoading(false);
  };

  const handleAddComment = async () => {
    if (!activity || !addComment || !newComment.trim()) return;

    setSubmitting(true);
    const success = await addComment(activity.id, newComment);
    if (success) {
      setNewComment('');
      await loadComments();
      // Scroll to bottom to show new comment
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
    setSubmitting(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!deleteComment) return;

    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteComment(commentId);
            if (success) {
              await loadComments();
            }
          },
        },
      ]
    );
  };

  const formatCommentTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (!activity) return null;

  const activityType = getActivityType(activity.activity_type);
  const isCreator = currentUserId === activity.creator_id;
  const isParticipant = activity.participants?.some(
    p => p.user_id === currentUserId && p.status === 'joined'
  );
  const hasPaidTicket = activity.tickets?.some(
    t => t.buyer_id === currentUserId && t.payment_status === 'paid'
  );
  const isFull = activity.current_participants >= activity.max_participants;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString([], {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTimeUntil = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffMs < 0) return 'Already started';
    if (diffDays > 0) return `In ${diffDays} day${diffDays > 1 ? 's' : ''}`;
    if (diffHours > 0) return `In ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    return 'Starting soon';
  };

  const openMaps = () => {
    const { latitude, longitude, location_name } = activity;
    const label = encodeURIComponent(location_name);

    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${latitude},${longitude}`,
      android: `geo:0,0?q=${latitude},${longitude}(${label})`,
    });

    if (url) {
      Linking.openURL(url).catch(() => {
        // Fallback to Google Maps web
        Linking.openURL(
          `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
        );
      });
    }
  };

  const handleComplete = () => {
    Alert.alert(
      'Complete Activity',
      'Mark this activity as completed?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Complete',
          onPress: () => {
            onComplete?.();
            onClose();
          },
        },
      ]
    );
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Activity',
      'Are you sure you want to cancel this activity? All participants will be notified.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => {
            onCancel?.();
            onClose();
          },
        },
      ]
    );
  };

  const getAvatarUrl = (user: any) => {
    if (user?.photos && user.photos.length > 0) {
      return user.photos[0];
    }
    return `${DEFAULT_AVATAR}&name=${encodeURIComponent(user?.name || 'User')}`;
  };

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
            <Text style={styles.headerTitle}>Activity Details</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {activity.image_url ? (
          <Image source={{ uri: activity.image_url }} style={styles.heroImg} />
        ) : (
          <View style={[styles.heroImg, styles.heroPlaceholder]}>
            <OutloLogo width={200} height={62} />
          </View>
        )}
        <ScrollView ref={scrollViewRef} style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Activity Type Badge */}
          <View style={[styles.typeBadge, { backgroundColor: (activityType?.color || theme.colors.primary) + '18' }]}>
            <Ionicons
              name={activityType?.icon || 'calendar-outline'}
              size={20}
              color={activityType?.color || theme.colors.primary}
            />
            <Text style={[styles.typeText, { color: activityType?.color || theme.colors.primary }]}>{activityType?.label || 'Activity'}</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>{activity.title}</Text>

          {/* Time Until */}
          {activity.status === 'completed' ? (
            <View style={styles.timeUntilBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={[styles.timeUntilText, { color: '#4CAF50' }]}>Completed</Text>
            </View>
          ) : activity.status === 'cancelled' ? (
            <View style={styles.timeUntilBadge}>
              <Ionicons name="close-circle" size={16} color={theme.colors.error} />
              <Text style={[styles.timeUntilText, { color: theme.colors.error }]}>Cancelled</Text>
            </View>
          ) : (
            <View style={styles.timeUntilBadge}>
              <Ionicons name="time" size={16} color={theme.colors.info} />
              <Text style={styles.timeUntilText}>{getTimeUntil(activity.scheduled_at)}</Text>
            </View>
          )}

          {/* Description */}
          {activity.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.description}>{activity.description}</Text>
            </View>
          )}

          {/* Date & Time */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>When</Text>
            <View style={styles.infoRow}>
              <Ionicons name="calendar" size={20} color={theme.colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoText}>{formatDate(activity.scheduled_at)}</Text>
                <Text style={styles.infoSubtext}>{formatTime(activity.scheduled_at)}</Text>
              </View>
            </View>
          </View>

          {/* Location */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Where</Text>
            <TouchableOpacity style={styles.infoRow} onPress={openMaps}>
              <Ionicons name="location" size={20} color={theme.colors.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoText}>{activity.location_name}</Text>
                <Text style={styles.infoSubtext}>Tap to open in Maps</Text>
              </View>
              <Ionicons name="navigate" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Creator */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Organized by</Text>
            <TouchableOpacity
              style={styles.creatorRow}
              onPress={() => onViewProfile(activity.creator_id)}
            >
              <Image
                source={{ uri: getAvatarUrl(activity.creator) }}
                style={styles.creatorAvatar}
              />
              <View style={styles.creatorInfo}>
                <Text style={styles.creatorName}>
                  {isCreator ? 'You' : activity.creator?.name || 'Unknown'}
                </Text>
                <Text style={styles.creatorSubtext}>
                  {isCreator ? 'View Profile' : 'View Profile'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Participants */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Participants ({activity.current_participants}/{activity.max_participants})
              </Text>
            </View>
            <View style={styles.participantsList}>
              {activity.participants?.filter(p => p.status === 'joined').map((participant) => (
                <TouchableOpacity
                  key={participant.id}
                  style={styles.participantItem}
                  onPress={() => onViewProfile(participant.user_id)}
                >
                  <Image
                    source={{ uri: getAvatarUrl(participant.user) }}
                    style={styles.participantAvatar}
                  />
                  <Text style={styles.participantName} numberOfLines={1}>
                    {participant.user_id === currentUserId
                      ? 'You'
                      : participant.user?.name || 'Unknown'}
                  </Text>
                  {participant.user_id === activity.creator_id && (
                    <View style={styles.creatorLabel}>
                      <Text style={styles.creatorLabelText}>Host</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}

              {activity.current_participants < activity.max_participants && (
                <View style={styles.spotAvailable}>
                  <View style={styles.spotAvailableIcon}>
                    <Ionicons name="add" size={20} color={theme.colors.textSecondary} />
                  </View>
                  <Text style={styles.spotAvailableText}>
                    {activity.max_participants - activity.current_participants} spot
                    {activity.max_participants - activity.current_participants > 1 ? 's' : ''}{' '}
                    available
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Comments Section */}
          {fetchComments && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  Comments ({comments.length})
                </Text>
              </View>

              <View style={styles.commentsList}>
                {commentsLoading ? (
                  <View style={styles.commentsLoading}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  </View>
                ) : comments.length === 0 ? (
                  <View style={styles.noComments}>
                    <Ionicons name="chatbubble-outline" size={24} color={theme.colors.textSecondary} />
                    <Text style={styles.noCommentsText}>No comments yet</Text>
                    <Text style={styles.noCommentsSubtext}>Be the first to ask a question!</Text>
                  </View>
                ) : (
                  comments.map((comment) => (
                    <View key={comment.id} style={styles.commentItem}>
                      <TouchableOpacity onPress={() => onViewProfile(comment.user_id)}>
                        <Image
                          source={{ uri: getAvatarUrl(comment.user) }}
                          style={styles.commentAvatar}
                        />
                      </TouchableOpacity>
                      <View style={styles.commentContent}>
                        <View style={styles.commentHeader}>
                          <TouchableOpacity onPress={() => onViewProfile(comment.user_id)}>
                            <Text style={styles.commentAuthor}>
                              {comment.user_id === currentUserId ? 'You' : comment.user?.name || 'Unknown'}
                            </Text>
                          </TouchableOpacity>
                          <Text style={styles.commentTime}>{formatCommentTime(comment.created_at)}</Text>
                        </View>
                        <Text style={styles.commentText}>{comment.content}</Text>
                      </View>
                      {comment.user_id === currentUserId && deleteComment && (
                        <TouchableOpacity
                          style={styles.deleteCommentButton}
                          onPress={() => handleDeleteComment(comment.id)}
                        >
                          <Ionicons name="trash-outline" size={16} color={theme.colors.textSecondary} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
                )}
              </View>
            </View>
          )}

          {/* Spacer for bottom fixed elements */}
          <View style={{ height: addComment ? 180 : 100 }} />
        </ScrollView>

        {/* Comment Input - Fixed above action buttons */}
        {fetchComments && addComment && (
          <View style={styles.commentInputWrapper}>
            <View style={styles.commentInputContainer}>
              <TextInput
                style={styles.commentInput}
                placeholder="Ask a question..."
                placeholderTextColor={theme.colors.textSecondary}
                value={newComment}
                onChangeText={setNewComment}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[
                  styles.sendCommentButton,
                  (!newComment.trim() || submitting) && styles.sendCommentButtonDisabled,
                ]}
                onPress={handleAddComment}
                disabled={!newComment.trim() || submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons name="send" size={18} color="white" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Action Button */}
        <View style={styles.actionContainer}>
          {activity.status === 'completed' ? (
            <View style={styles.completedBanner}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.completedBannerText}>Activity Completed</Text>
            </View>
          ) : activity.status === 'cancelled' ? (
            <View style={styles.cancelledBanner}>
              <Ionicons name="close-circle" size={20} color={theme.colors.error} />
              <Text style={styles.cancelledBannerText}>Activity Cancelled</Text>
            </View>
          ) : isCreator ? (
            <View style={{ gap: 10 }}>
              {!activity.is_boosted && (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    backgroundColor: '#F59E0B',
                    paddingVertical: 14,
                    borderRadius: 12,
                  }}
                  onPress={() => {
                    onClose();
                    (navigation as any)?.navigate?.('ActivityPublished', {
                      activityId: activity.id,
                      isPaid: activity.is_paid,
                    });
                  }}
                >
                  <Ionicons name="rocket" size={20} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '800' }}>Promote on Map</Text>
                </TouchableOpacity>
              )}
              {activity.is_paid && (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    backgroundColor: '#166834',
                    paddingVertical: 14,
                    borderRadius: 12,
                  }}
                  onPress={() => {
                    onClose();
                    (navigation as any)?.navigate?.('CreatorWallet');
                  }}
                >
                  <Ionicons name="wallet" size={20} color="#4CAF50" />
                  <Text style={{ color: '#4CAF50', fontWeight: '800' }}>My Earnings</Text>
                </TouchableOpacity>
              )}
              <View style={styles.creatorActions}>
                <TouchableOpacity style={styles.completeButton} onPress={handleComplete}>
                  <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  <Text style={styles.completeButtonText}>Complete</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                  <Ionicons name="close-circle" size={20} color={theme.colors.error} />
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (activity.is_paid ? hasPaidTicket : isParticipant) ? (
            activity.is_paid ? (
              <View style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: 8, backgroundColor: '#DCFCE7', padding: 14, borderRadius: 12,
              }}>
                <Ionicons name="ticket" size={20} color="#16A34A" />
                <Text style={{ color: '#15803D', fontWeight: '700' }}>Ticket confirmed</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.leaveButton} onPress={onJoin}>
                <Ionicons name="exit" size={20} color={theme.colors.error} />
                <Text style={styles.leaveButtonText}>Leave Activity</Text>
              </TouchableOpacity>
            )
          ) : activity.is_paid ? (
            <TouchableOpacity
              style={[styles.joinButton, isFull && styles.joinButtonDisabled,
              { backgroundColor: '#16A34A' }]}
              onPress={() => {
                onClose();
                (navigation as any)?.navigate?.('TicketCheckout', { activityId: activity.id });
              }}
              disabled={isFull}
            >
              <Ionicons name="ticket" size={20} color="white" />
              <Text style={styles.joinButtonText}>
                {isFull
                  ? 'Sold Out'
                  : `Buy Ticket · €${((activity.ticket_price_cents ?? 0) / 100).toFixed(2)}`}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.joinButton, isFull && styles.joinButtonDisabled]}
              onPress={onJoin}
              disabled={isFull}
            >
              <Ionicons name="add-circle" size={20} color="white" />
              <Text style={styles.joinButtonText}>
                {isFull ? 'Activity Full' : 'Join Activity'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
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
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
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
  heroImg: {
    width: '100%',
    height: 200,
    backgroundColor: t.colors.surface,
  },
  heroPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: t.colors.inputBg,
  },
  content: {
    flex: 1,
    padding: t.spacing.lg,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: t.colors.primary + '15',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: t.spacing.md,
    gap: 6,
  },
  typeText: {
    fontSize: 14,
    fontWeight: '600',
    color: t.colors.primary,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: t.colors.text,
    marginBottom: t.spacing.sm,
  },
  timeUntilBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: t.spacing.lg,
  },
  timeUntilText: {
    fontSize: 14,
    color: t.colors.info,
    fontWeight: '500',
  },
  section: {
    marginBottom: t.spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: t.colors.text,
    marginBottom: t.spacing.sm,
  },
  description: {
    fontSize: 15,
    color: t.colors.textSecondary,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.colors.surface,
    padding: t.spacing.md,
    borderRadius: t.borderRadius.md,
    gap: t.spacing.md,
  },
  infoContent: {
    flex: 1,
  },
  infoText: {
    fontSize: 15,
    fontWeight: '500',
    color: t.colors.text,
  },
  infoSubtext: {
    fontSize: 13,
    color: t.colors.textSecondary,
    marginTop: 2,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.colors.surface,
    padding: t.spacing.md,
    borderRadius: t.borderRadius.md,
    gap: t.spacing.md,
  },
  creatorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  creatorInfo: {
    flex: 1,
  },
  creatorName: {
    fontSize: 16,
    fontWeight: '600',
    color: t.colors.text,
  },
  creatorSubtext: {
    fontSize: 13,
    color: t.colors.textSecondary,
    marginTop: 2,
  },
  participantsList: {
    backgroundColor: t.colors.surface,
    borderRadius: t.borderRadius.md,
    padding: t.spacing.sm,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: t.spacing.sm,
    gap: t.spacing.sm,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  participantName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: t.colors.text,
  },
  creatorLabel: {
    backgroundColor: t.colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  creatorLabelText: {
    fontSize: 11,
    fontWeight: '600',
    color: t.colors.primary,
  },
  spotAvailable: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: t.spacing.sm,
    gap: t.spacing.sm,
  },
  spotAvailableIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: t.colors.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: t.colors.gray[200],
    borderStyle: 'dashed',
  },
  spotAvailableText: {
    fontSize: 14,
    color: t.colors.textSecondary,
  },
  commentInputWrapper: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    padding: t.spacing.md,
    paddingBottom: t.spacing.sm,
    backgroundColor: t.colors.surface,
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
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
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.primary,
    paddingVertical: t.spacing.md,
    borderRadius: t.borderRadius.lg,
    gap: t.spacing.sm,
  },
  joinButtonDisabled: {
    backgroundColor: t.colors.gray[300],
  },
  joinButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.error + '15',
    borderWidth: 1,
    borderColor: t.colors.error,
    paddingVertical: t.spacing.md,
    borderRadius: t.borderRadius.lg,
    gap: t.spacing.sm,
  },
  leaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: t.colors.error,
  },
  creatorActions: {
    flexDirection: 'row',
    gap: t.spacing.sm,
  },
  completeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#4CAF50',
    paddingVertical: t.spacing.md,
    borderRadius: t.borderRadius.lg,
    gap: t.spacing.sm,
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.error + '15',
    borderWidth: 1,
    borderColor: t.colors.error,
    paddingVertical: t.spacing.md,
    borderRadius: t.borderRadius.lg,
    gap: t.spacing.sm,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: t.colors.error,
  },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: t.spacing.md,
    borderRadius: t.borderRadius.lg,
    gap: t.spacing.sm,
  },
  completedBannerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  cancelledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.error + '15',
    paddingVertical: t.spacing.md,
    borderRadius: t.borderRadius.lg,
    gap: t.spacing.sm,
  },
  cancelledBannerText: {
    fontSize: 16,
    fontWeight: '600',
    color: t.colors.error,
  },
  // Comments styles
  commentsList: {
    backgroundColor: t.colors.surface,
    borderRadius: t.borderRadius.md,
    padding: t.spacing.sm,
    minHeight: 80,
  },
  commentsLoading: {
    padding: t.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noComments: {
    padding: t.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noCommentsText: {
    fontSize: 15,
    fontWeight: '500',
    color: t.colors.textSecondary,
    marginTop: t.spacing.sm,
  },
  noCommentsSubtext: {
    fontSize: 13,
    color: t.colors.textSecondary,
    marginTop: 4,
  },
  commentItem: {
    flexDirection: 'row',
    padding: t.spacing.sm,
    gap: t.spacing.sm,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    marginBottom: 2,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: t.colors.text,
  },
  commentTime: {
    fontSize: 12,
    color: t.colors.textSecondary,
  },
  commentText: {
    fontSize: 14,
    color: t.colors.text,
    lineHeight: 20,
  },
  deleteCommentButton: {
    padding: t.spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: t.spacing.sm,
    gap: t.spacing.sm,
  },
  commentInput: {
    flex: 1,
    backgroundColor: t.colors.surface,
    borderRadius: t.borderRadius.lg,
    borderWidth: 1,
    borderColor: t.colors.border,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    fontSize: 14,
    color: t.colors.text,
    maxHeight: 100,
  },
  sendCommentButton: {
    backgroundColor: t.colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendCommentButtonDisabled: {
    backgroundColor: t.colors.gray[300],
  },
});
