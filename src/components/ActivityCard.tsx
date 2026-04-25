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
import PriceBadge from './PriceBadge';
import BoostBadge from './BoostBadge';

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
  if (km < 0.05) {
    return 'Nearby';
  }
  if (km < 1) {
    return `${Math.round(km * 1000)}m away`;
  }
  return `${km.toFixed(1)} km away`;
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
  // Use actual participants array count if available, fallback to current_participants
  const actualParticipants = activity.participants
    ? activity.participants.filter(p => p.status === 'joined').length
    : activity.current_participants;
  const isFull = actualParticipants >= activity.max_participants;
  const spotsLeft = activity.max_participants - actualParticipants;

  const isPast = new Date(activity.scheduled_at).getTime() < Date.now() - 2 * 60 * 60 * 1000;
  const isStarted = !isPast && new Date(activity.scheduled_at).getTime() < Date.now();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === now.toDateString()) {
      return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return `Tomorrow, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
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

  const getParticipantAvatars = () => {
    const avatars: string[] = [];
    avatars.push(getCreatorAvatar());
    if (activity.participants) {
      activity.participants
        .filter(p => p.status === 'joined' && p.user_id !== activity.creator_id)
        .slice(0, 2)
        .forEach(p => {
          if (p.user?.photos && p.user.photos.length > 0) {
            avatars.push(p.user.photos[0]);
          } else {
            avatars.push(`${DEFAULT_AVATAR}&name=${encodeURIComponent(p.user?.name || 'User')}`);
          }
        });
    }
    return avatars.slice(0, 3);
  };

  const getParticipantNames = () => {
    const names: string[] = [];
    if (activity.creator?.name) {
      names.push(isCreator ? 'You' : activity.creator.name.split(' ')[0]);
    }
    if (activity.participants) {
      activity.participants
        .filter(p => p.status === 'joined' && p.user_id !== activity.creator_id)
        .forEach(p => {
          if (p.user?.name) {
            names.push(p.user_id === currentUserId ? 'You' : p.user.name.split(' ')[0]);
          }
        });
    }
    const shown = names.slice(0, 2);
    const remaining = actualParticipants - shown.length;
    if (remaining > 0) {
      return `${shown.join(', ')} & ${remaining} others`;
    }
    return shown.join(', ');
  };

  const avatars = getParticipantAvatars();
  const remainingCount = actualParticipants - avatars.length;

  const typeColor = activityType?.color || '#4CAF50';

  return (
    <TouchableOpacity style={[styles.container, activity.status === 'cancelled' && styles.pastContainer]} onPress={onPress} activeOpacity={0.8}>
      {/* Header: Icon + Title + Spots */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={[styles.typeIcon, { backgroundColor: typeColor + '18' }, activity.status === 'cancelled' && { backgroundColor: '#E0E0E0' }]}>
            <Ionicons
              name={activityType?.icon || 'calendar-outline'}
              size={22}
              color={activity.status === 'cancelled' ? '#999' : typeColor}
            />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.title} numberOfLines={1}>{activity.title}</Text>
            {(activity.is_paid || activity.is_boosted) && (
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, marginBottom: 2 }}>
                {activity.is_boosted && <BoostBadge size="sm" />}
                {activity.is_paid && (
                  <PriceBadge
                    isPaid
                    priceCents={activity.ticket_price_cents}
                    currency={activity.currency || 'EUR'}
                    size="sm"
                  />
                )}
              </View>
            )}
            <View style={styles.locationRow}>
              <Ionicons name="location" size={13} color={theme.colors.textSecondary} />
              <Text style={styles.locationText} numberOfLines={1}>
                {distance !== undefined ? formatDistance(distance) : activity.location_name}
              </Text>
            </View>
          </View>
        </View>
        {/* Status badges */}
        {activity.status === 'completed' ? (
          <View style={styles.completedBadge}>
            <Text style={styles.completedBadgeText}>Completed</Text>
          </View>
        ) : activity.status === 'cancelled' ? (
          <View style={styles.pastBadge}>
            <Text style={styles.pastBadgeText}>Cancelled</Text>
          </View>
        ) : isPast ? (
          <View style={styles.pastBadge}>
            <Text style={styles.pastBadgeText}>Past</Text>
          </View>
        ) : isStarted ? (
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>Live</Text>
          </View>
        ) : !isFull ? (
          <View style={styles.spotsBadge}>
            <Text style={styles.spotsText}>{spotsLeft} spots left</Text>
          </View>
        ) : (
          <View style={styles.fullBadge}>
            <Text style={styles.fullBadgeText}>Full</Text>
          </View>
        )}
      </View>

      {/* Description */}
      {activity.description && (
        <Text style={styles.description} numberOfLines={2}>
          {activity.description}
        </Text>
      )}

      {/* Info: Date + Participants count */}
      <View style={styles.infoRow}>
        <View style={styles.infoItem}>
          <Ionicons name="calendar-outline" size={14} color={theme.colors.textSecondary} />
          <Text style={styles.infoText}>{formatDate(activity.scheduled_at)}</Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="people" size={14} color={theme.colors.textSecondary} />
          <Text style={styles.infoText}>
            {actualParticipants}/{activity.max_participants} joined
          </Text>
        </View>
      </View>

      {/* Participants Avatars */}
      <View style={styles.participantsRow}>
        <View style={styles.avatarStack}>
          {avatars.map((uri, i) => (
            <Image
              key={i}
              source={{ uri }}
              style={[styles.avatar, { marginLeft: i > 0 ? -8 : 0, zIndex: avatars.length - i }]}
            />
          ))}
          {remainingCount > 0 && (
            <View style={[styles.avatarMore, { marginLeft: -8 }]}>
              <Text style={styles.avatarMoreText}>+{remainingCount}</Text>
            </View>
          )}
        </View>
        <Text style={styles.participantNames} numberOfLines={1}>{getParticipantNames()}</Text>
      </View>

      {/* Action Button */}
      {activity.status === 'completed' ? (
        <View style={styles.completedButton}>
          <Text style={styles.completedButtonText}>Completed ✓</Text>
        </View>
      ) : activity.status === 'cancelled' ? (
        <View style={styles.cancelledButton}>
          <Text style={styles.cancelledButtonText}>Cancelled</Text>
        </View>
      ) : showJoinButton && !isCreator ? (
        <TouchableOpacity
          style={[
            styles.joinButton,
            isParticipant && styles.joinedButton,
            isFull && !isParticipant && styles.disabledButton,
          ]}
          onPress={(e) => {
            e.stopPropagation();
            onJoin?.();
          }}
          disabled={isFull && !isParticipant}
        >
          <Text style={[
            styles.joinButtonText,
            isParticipant && styles.joinedButtonText,
            isFull && !isParticipant && styles.disabledButtonText,
          ]}>
            {isParticipant ? 'Joined ✓' : isFull ? 'Full' : 'Join Activity'}
          </Text>
        </TouchableOpacity>
      ) : isCreator ? (
        <View style={styles.creatorButton}>
          <Text style={styles.creatorButtonText}>Your Activity</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  pastContainer: {
    opacity: 0.6,
  },
  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  typeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  locationText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  spotsBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  spotsText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4CAF50',
  },
  fullBadge: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  fullBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E53935',
  },
  pastBadge: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  pastBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
  },
  completedBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  completedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },
  liveBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  liveBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },
  // Description
  description: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 12,
  },
  // Info row
  infoRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 14,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  infoText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  // Participants
  participantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarMore: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarMoreText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666',
  },
  participantNames: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  // Buttons
  joinButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  joinedButton: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1.5,
    borderColor: '#4CAF50',
  },
  joinedButtonText: {
    color: '#4CAF50',
  },
  disabledButton: {
    backgroundColor: '#F5F5F5',
  },
  disabledButtonText: {
    color: '#999',
  },
  creatorButton: {
    backgroundColor: '#FFF3E0',
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FF9800',
  },
  creatorButtonText: {
    color: '#FF9800',
    fontSize: 15,
    fontWeight: '700',
  },
  completedButton: {
    backgroundColor: '#E8F5E9',
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
  },
  completedButtonText: {
    color: '#4CAF50',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelledButton: {
    backgroundColor: '#FFEBEE',
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
  },
  cancelledButtonText: {
    color: '#E53935',
    fontSize: 15,
    fontWeight: '700',
  },
});
