import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import {
  getBadgeLevelById,
  getSkillLevel,
  getBadgeEmoji,
  BadgeLevelId,
  SkillLevelId,
} from '../constants/skillTypes';

interface SkillBadgeDisplayProps {
  badgeLevel: BadgeLevelId;
  sessionsCompleted?: number;
  averageRating?: number | null;
  size?: 'tiny' | 'small' | 'medium' | 'large';
  showDetails?: boolean;
}

export function SkillBadgeDisplay({
  badgeLevel,
  sessionsCompleted = 0,
  averageRating,
  size = 'medium',
  showDetails = false,
}: SkillBadgeDisplayProps) {
  const badge = getBadgeLevelById(badgeLevel);
  if (!badge) return null;

  const sizeConfig = {
    tiny: { iconSize: 12, fontSize: 0, padding: 2, showLabel: false },
    small: { iconSize: 16, fontSize: 10, padding: 4, showLabel: true },
    medium: { iconSize: 20, fontSize: 12, padding: 6, showLabel: true },
    large: { iconSize: 28, fontSize: 14, padding: 8, showLabel: true },
  };

  const config = sizeConfig[size];
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.badge,
          { backgroundColor: badge.color + '30', padding: config.padding },
        ]}
      >
        <Text style={{ fontSize: config.iconSize }}>{getBadgeEmoji(badgeLevel)}</Text>
        {config.showLabel && (
          <Text
            style={[
              styles.badgeLabel,
              { color: badge.color, fontSize: config.fontSize },
            ]}
          >
            {badge.label}
          </Text>
        )}
      </View>
      {showDetails && (
        <View style={styles.details}>
          <Text style={styles.detailText}>{sessionsCompleted} sessions</Text>
          {averageRating !== null && averageRating !== undefined && (
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={12} color="#FFD700" />
              <Text style={styles.detailText}>{averageRating.toFixed(1)}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

interface SkillLevelBadgeProps {
  level: SkillLevelId;
  size?: 'small' | 'medium';
}

export function SkillLevelBadge({ level, size = 'medium' }: SkillLevelBadgeProps) {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const levelInfo = getSkillLevel(level);
  if (!levelInfo) return null;

  const colors: Record<SkillLevelId, string> = {
    beginner: '#4CAF50',
    intermediate: '#2196F3',
    advanced: '#9C27B0',
    expert: '#FF9800',
  };

  const sizeStyles = size === 'small' ? styles.levelBadgeSmall : styles.levelBadge;
  const textStyles = size === 'small' ? styles.levelTextSmall : styles.levelText;

  return (
    <View style={[sizeStyles, { backgroundColor: colors[level] + '20' }]}>
      <Text style={[textStyles, { color: colors[level] }]}>
        {levelInfo.label}
      </Text>
    </View>
  );
}

const makeStyles = (t: any) => StyleSheet.create({
  container: {
    alignItems: 'flex-start',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    gap: 4,
  },
  badgeLabel: {
    fontWeight: '600',
  },
  details: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  detailText: {
    fontSize: 11,
    color: t.colors.textSecondary,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  levelBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  levelText: {
    fontSize: 12,
    fontWeight: '600',
  },
  levelTextSmall: {
    fontSize: 10,
    fontWeight: '600',
  },
});

export default SkillBadgeDisplay;
