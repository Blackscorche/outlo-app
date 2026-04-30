import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Tables } from '../integrations/supabase/types';
import { SkillBadgeDisplay, SkillLevelBadge } from './SkillBadgeDisplay';
import { getSkillLevel } from '../constants/skillTypes';
import { useTheme } from '../contexts/ThemeContext';

const DEFAULT_AVATAR = 'https://ui-avatars.com/api/?background=FF1744&color=fff&size=100';

interface SkillMatchCardProps {
  user: {
    id: string;
    name: string;
    photos: string[] | null;
    age?: number | null;
    bio?: string | null;
  };
  distance?: number;
  skillsCanTeach: (Tables<'user_skills'> & {
    skill?: Tables<'skills'> & { category?: Tables<'skill_categories'> };
    badge?: Tables<'skill_badges'>;
  })[];
  skillsWantToLearn: (Tables<'user_skill_wants'> & {
    skill?: Tables<'skills'> & { category?: Tables<'skill_categories'> };
  })[];
  isMutualMatch: boolean;
  matchingTeachSkillIds: string[];
  matchingLearnSkillIds: string[];
  onPress: () => void;
  onProposeExchange?: () => void;
}

const formatDistance = (km: number): string => {
  if (km < 1) {
    return `${Math.round(km * 1000)}m`;
  }
  return `${km.toFixed(1)}km`;
};

export default function SkillMatchCard({
  user,
  distance,
  skillsCanTeach,
  skillsWantToLearn,
  isMutualMatch,
  matchingTeachSkillIds,
  matchingLearnSkillIds,
  onPress,
  onProposeExchange,
}: SkillMatchCardProps) {
  const getAvatar = () => {
    if (user.photos && user.photos.length > 0) {
      return user.photos[0];
    }
    return `${DEFAULT_AVATAR}&name=${encodeURIComponent(user.name || 'User')}`;
  };

  // Filter to show only matching skills first
  const matchingTeachSkills = skillsCanTeach.filter(s =>
    matchingTeachSkillIds.includes(s.skill_id)
  );
  const otherTeachSkills = skillsCanTeach.filter(s =>
    !matchingTeachSkillIds.includes(s.skill_id)
  );

  const matchingLearnSkills = skillsWantToLearn.filter(s =>
    matchingLearnSkillIds.includes(s.skill_id)
  );
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Mutual Match Badge */}
      {isMutualMatch && (
        <View style={styles.mutualBadge}>
          <Ionicons name="swap-horizontal" size={12} color="white" />
          <Text style={styles.mutualBadgeText}>Mutual Match</Text>
        </View>
      )}

      {/* User Info Row */}
      <View style={styles.userRow}>
        <Image source={{ uri: getAvatar() }} style={styles.avatar} />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>
            {user.name}
            {user.age && `, ${user.age}`}
          </Text>
          {distance !== undefined && (
            <View style={styles.distanceRow}>
              <Ionicons name="location-outline" size={14} color={theme.colors.textSecondary} />
              <Text style={styles.distanceText}>{formatDistance(distance)}</Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
      </View>

      {/* Skills They Can Teach (that you want) */}
      {matchingTeachSkills.length > 0 && (
        <View style={styles.skillsSection}>
          <Text style={styles.skillsSectionTitle}>
            <Ionicons name="school" size={14} color={theme.colors.success} /> Can teach you:
          </Text>
          <View style={styles.skillsChips}>
            {matchingTeachSkills.slice(0, 3).map(skill => (
              <View key={skill.id} style={styles.skillChip}>
                <Ionicons
                  name={(skill.skill?.icon || 'star-outline') as any}
                  size={14}
                  color={theme.colors.primary}
                />
                <Text style={styles.skillChipText}>{skill.skill?.name}</Text>
                <SkillLevelBadge level={skill.level} size="small" />
                {skill.badge && (
                  <View style={styles.badgeInline}>
                    <SkillBadgeDisplay
                      badgeLevel={skill.badge.badge_level}
                      size="small"
                    />
                  </View>
                )}
              </View>
            ))}
            {matchingTeachSkills.length > 3 && (
              <Text style={styles.moreSkillsText}>
                +{matchingTeachSkills.length - 3} more
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Skills They Want to Learn (that you can teach) */}
      {matchingLearnSkills.length > 0 && (
        <View style={styles.skillsSection}>
          <Text style={styles.skillsSectionTitle}>
            <Ionicons name="book" size={14} color="#2196F3" /> Wants to learn:
          </Text>
          <View style={styles.skillsChips}>
            {matchingLearnSkills.slice(0, 3).map(skill => (
              <View key={skill.id} style={[styles.skillChip, styles.learnChip]}>
                <Ionicons
                  name={(skill.skill?.icon || 'star-outline') as any}
                  size={14}
                  color="#2196F3"
                />
                <Text style={[styles.skillChipText, styles.learnChipText]}>
                  {skill.skill?.name}
                </Text>
              </View>
            ))}
            {matchingLearnSkills.length > 3 && (
              <Text style={styles.moreSkillsText}>
                +{matchingLearnSkills.length - 3} more
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Action Button */}
      {onProposeExchange && isMutualMatch && (
        <TouchableOpacity
          style={styles.proposeButton}
          onPress={(e) => {
            e.stopPropagation();
            onProposeExchange();
          }}
        >
          <Ionicons name="swap-horizontal" size={16} color="white" />
          <Text style={styles.proposeButtonText}>Propose Exchange</Text>
        </TouchableOpacity>
      )}

      {onProposeExchange && !isMutualMatch && matchingTeachSkills.length > 0 && (
        <TouchableOpacity
          style={[styles.proposeButton, styles.requestButton]}
          onPress={(e) => {
            e.stopPropagation();
            onProposeExchange();
          }}
        >
          <Ionicons name="paper-plane" size={16} color={theme.colors.primary} />
          <Text style={[styles.proposeButtonText, styles.requestButtonText]}>
            Request Lesson
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const makeStyles = (t: any) => StyleSheet.create({
  container: {
    backgroundColor: t.colors.surface,
    borderRadius: t.borderRadius.lg,
    padding: t.spacing.md,
    marginBottom: t.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  mutualBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: t.colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomLeftRadius: 12,
    gap: 4,
  },
  mutualBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'white',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: t.spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: t.spacing.md,
    borderWidth: 2,
    borderColor: t.colors.primary + '30',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: t.colors.text,
    marginBottom: 2,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distanceText: {
    fontSize: 13,
    color: t.colors.textSecondary,
  },
  skillsSection: {
    marginTop: t.spacing.sm,
  },
  skillsSectionTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: t.colors.textSecondary,
    marginBottom: 6,
  },
  skillsChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  skillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.colors.primary + '10',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  skillChipText: {
    fontSize: 13,
    color: t.colors.primary,
    fontWeight: '500',
  },
  learnChip: {
    backgroundColor: '#2196F3' + '10',
  },
  learnChipText: {
    color: '#2196F3',
  },
  badgeInline: {
    marginLeft: 2,
  },
  moreSkillsText: {
    fontSize: 12,
    color: t.colors.textSecondary,
    fontStyle: 'italic',
  },
  proposeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.success,
    paddingVertical: 10,
    borderRadius: t.borderRadius.md,
    marginTop: t.spacing.md,
    gap: 8,
  },
  proposeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  requestButton: {
    backgroundColor: t.colors.primary + '15',
    borderWidth: 1,
    borderColor: t.colors.primary,
  },
  requestButtonText: {
    color: t.colors.primary,
  },
});
