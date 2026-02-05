import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { Activity } from '../hooks/useActivities';
import { getActivityType, getActivityIcon } from '../constants/activityTypes';

interface ActivityCardProps {
  activity: Activity;
  currentUserId?: string;
  onPress: () => void;
  onJoin?: () => void;
  showJoinButton?: boolean;
  distance?: number;
}

const DEFAULT_AVATAR = 'https://ui-avatars.com/api/?background=FF1744&color=fff&size=100';

const formatDistance = (km: number): string => {
  if (km < 1) {
    return `${Math.round(km * 1000)}m`;
  }
  return `${km.toFixed(1)}km`;
};

export default function ActivityCard({
  activity,
  currentUserId,
  onPress,
  onJoin,
  showJoinButton = true,
  distance,
}: ActivityCardProps) {
  const activityType = getActivityType(activity.activity_type);
  const isCreator = currentUserId === activity.creator_id;
  const isParticipant = activity.participants?.some(
    p => p.user_id === currentUserId && p.status === 'joined'
  );
  const isFull = activity.current_participants >= activity.max_participants;

  // Check if activity is in the past (more than 2 hours ago)
  const isPast = new Date(activity.scheduled_at).getTime() < Date.now() - 2 * 60 * 60 * 1000;

  // Check if activity has started (scheduled time has passed but not past yet)
  const isStarted = !isPast && new Date(activity.scheduled_at).getTime() < Date.now();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    // Check if it's today
    if (date.toDateString() === now.toDateString()) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    // Check if it's tomorrow
    if (date.toDateString() === tomorrow.toDateString()) {
      return `Tomorrow at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    // Check if it's yesterday
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    // Otherwise show date and time
    return date.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCreatorAvatar = () => {
    if (activity.creator?.photos && activity.creator.photos.length > 0) {
      return activity.creator.photos[0];
    }
    return `${DEFAULT_AVATAR}&name=${encodeURIComponent(activity.creator?.name || 'User')}`;
  };

  return (
    <TouchableOpacity style={[styles.container, isPast && styles.pastContainer]} onPress={onPress} activeOpacity={0.8}>
      {/* Past Activity Badge */}
      {isPast && activity.status !== 'cancelled' && (
        <View style={styles.pastBadge}>
          <Ionicons name="time" size={12} color={theme.colors.textSecondary} />
          <Text style={styles.pastBadgeText}>Past</Text>
        </View>
      )}

      {/* In Progress Badge */}
      {isStarted && activity.status !== 'cancelled' && (
        <View style={styles.inProgressBadge}>
          <Ionicons name="play-circle" size={12} color="#fff" />
          <Text style={styles.inProgressBadgeText}>In Progress</Text>
        </View>
      )}

      {/* Activity Type Badge */}
      <View style={[styles.typeBadge, isPast && styles.pastTypeBadge]}>
        <Ionicons
          name={activityType?.icon || 'calendar-outline'}
          size={16}
          color={isPast ? theme.colors.textSecondary : theme.colors.primary}
        />
        <Text style={[styles.typeText, isPast && styles.pastTypeText]}>
          {activityType?.label || 'Activity'}
        </Text>
      </View>

      {/* Title and Description */}
      <Text style={styles.title} numberOfLines={2}>
        {activity.title}
      </Text>
      {activity.description && (
        <Text style={styles.description} numberOfLines={2}>
          {activity.description}
        </Text>
      )}

      {/* Info Row */}
      <View style={styles.infoRow}>
        {/* Location */}
        <View style={styles.infoItem}>
          <Ionicons name="location-outline" size={14} color={theme.colors.textSecondary} />
          <Text style={styles.infoText} numberOfLines={1}>
            {activity.location_name}
            {distance !== undefined && ` (${formatDistance(distance)})`}
          </Text>
        </View>

        {/* Date/Time */}
        <View style={styles.infoItem}>
          <Ionicons name="time-outline" size={14} color={theme.colors.textSecondary} />
          <Text style={styles.infoText}>{formatDate(activity.scheduled_at)}</Text>
        </View>
      </View>

      {/* Footer Row */}
      <View style={styles.footerRow}>
        {/* Creator */}
        <View style={styles.creatorSection}>
          <Image source={{ uri: getCreatorAvatar() }} style={styles.creatorAvatar} />
          <Text style={styles.creatorName} numberOfLines={1}>
            {isCreator ? 'You' : activity.creator?.name || 'Unknown'}
          </Text>
        </View>

        {/* Participants Count */}
        <View style={styles.participantsSection}>
          <View style={styles.participantsCount}>
            <Ionicons name="people" size={14} color={theme.colors.textSecondary} />
            <Text style={styles.participantsText}>
              {activity.current_participants}/{activity.max_participants}
            </Text>
          </View>

          {/* Join Button */}
          {showJoinButton && !isCreator && (
            <TouchableOpacity
              style={[
                styles.joinButton,
                isParticipant && styles.joinedButton,
                isFull && !isParticipant && styles.fullButton,
              ]}
              onPress={(e) => {
                e.stopPropagation();
                onJoin?.();
              }}
              disabled={isFull && !isParticipant}
            >
              <Text
                style={[
                  styles.joinButtonText,
                  isParticipant && styles.joinedButtonText,
                  isFull && !isParticipant && styles.fullButtonText,
                ]}
              >
                {isParticipant ? 'Joined' : isFull ? 'Full' : 'Join'}
              </Text>
            </TouchableOpacity>
          )}

          {isCreator && (
            <View style={styles.creatorBadge}>
              <Text style={styles.creatorBadgeText}>Creator</Text>
            </View>
          )}
        </View>
      </View>

      {/* Status Badge for cancelled activities */}
      {activity.status === 'cancelled' && (
        <View style={styles.cancelledOverlay}>
          <Text style={styles.cancelledText}>Cancelled</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: theme.spacing.sm,
    gap: 4,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    maxWidth: 150,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  creatorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  creatorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  creatorName: {
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: '500',
    maxWidth: 100,
  },
  participantsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  participantsCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  participantsText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  joinButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  joinButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  joinedButton: {
    backgroundColor: theme.colors.success + '20',
    borderWidth: 1,
    borderColor: theme.colors.success,
  },
  joinedButtonText: {
    color: theme.colors.success,
  },
  fullButton: {
    backgroundColor: theme.colors.gray[200],
  },
  fullButtonText: {
    color: theme.colors.textSecondary,
  },
  creatorBadge: {
    backgroundColor: theme.colors.primary + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  creatorBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  cancelledOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelledText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.error,
    textTransform: 'uppercase',
  },
  pastContainer: {
    opacity: 0.7,
    borderColor: theme.colors.gray[300],
    borderWidth: 1,
  },
  pastBadge: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.gray[200],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
    zIndex: 10,
  },
  pastBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  pastTypeBadge: {
    backgroundColor: theme.colors.gray[200],
  },
  pastTypeText: {
    color: theme.colors.textSecondary,
  },
  inProgressBadge: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.success,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
    zIndex: 10,
  },
  inProgressBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
});
