import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { useSkills, UserSkillWithDetails, UserSkillWantWithDetails } from '../hooks/useSkills';
import { getSkillLevel, SkillLevelId } from '../constants/skillTypes';
import { SkillBadgeDisplay, SkillLevelBadge } from './SkillBadgeDisplay';
import SkillSelectionModal from './SkillSelectionModal';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface SkillEditSectionProps {
  isEditing?: boolean;
  showTitle?: boolean;
  compactMode?: boolean;
}

type SelectedSkill = {
  type: 'teach';
  skill: UserSkillWithDetails;
} | {
  type: 'learn';
  skill: UserSkillWantWithDetails;
} | null;

export default function SkillEditSection({
  isEditing = false,
  showTitle = true,
  compactMode = false,
}: SkillEditSectionProps) {
  const {
    mySkills,
    mySkillWants,
    loading,
    addSkill,
    removeSkill,
    addSkillWant,
    removeSkillWant,
  } = useSkills();

  const [showTeachModal, setShowTeachModal] = useState(false);
  const [showLearnModal, setShowLearnModal] = useState(false);
  const [removingSkillId, setRemovingSkillId] = useState<string | null>(null);
  const [teachExpanded, setTeachExpanded] = useState(isEditing);
  const [learnExpanded, setLearnExpanded] = useState(isEditing);
  const [selectedSkill, setSelectedSkill] = useState<SelectedSkill>(null);

  const toggleTeachSection = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTeachExpanded(!teachExpanded);
  };

  const toggleLearnSection = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setLearnExpanded(!learnExpanded);
  };

  const handleAddTeachSkill = async (data: {
    skill_id: string;
    skill_name: string;
    level?: SkillLevelId;
    description?: string;
  }) => {
    if (!data.level) return;
    await addSkill({
      skill_id: data.skill_id,
      level: data.level,
      description: data.description,
    });
  };

  const handleAddLearnSkill = async (data: {
    skill_id: string;
    skill_name: string;
    description?: string;
  }) => {
    await addSkillWant({
      skill_id: data.skill_id,
      description: data.description,
    });
  };

  const handleRemoveSkill = (skillId: string, skillName: string) => {
    Alert.alert(
      'Remove Skill',
      `Remove "${skillName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemovingSkillId(skillId);
            await removeSkill(skillId);
            setRemovingSkillId(null);
            setSelectedSkill(null);
          },
        },
      ]
    );
  };

  const handleRemoveSkillWant = (skillId: string, skillName: string) => {
    Alert.alert(
      'Remove Skill',
      `Remove "${skillName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemovingSkillId(skillId);
            await removeSkillWant(skillId);
            setRemovingSkillId(null);
            setSelectedSkill(null);
          },
        },
      ]
    );
  };

  // Compact chip for teach skills
  const renderTeachChip = (skill: UserSkillWithDetails) => {
    const isRemoving = removingSkillId === skill.skill_id;
    const levelInfo = getSkillLevel(skill.level);
    const levelColor = levelInfo?.color ?? '#666';

    return (
      <TouchableOpacity
        key={skill.id}
        style={styles.skillChip}
        onPress={() => setSelectedSkill({ type: 'teach', skill })}
        activeOpacity={0.7}
      >
        <Ionicons
          name={(skill.skill?.icon || 'star-outline') as any}
          size={14}
          color={theme.colors.primary}
        />
        <Text style={styles.chipText} numberOfLines={1}>
          {skill.skill?.name}
        </Text>
        <View style={[styles.levelDot, { backgroundColor: levelColor }]} />
        {skill.badge && (
          <SkillBadgeDisplay
            badgeLevel={skill.badge.badge_level}
            size="tiny"
          />
        )}
        {isEditing && (
          <TouchableOpacity
            style={styles.chipRemove}
            onPress={(e) => {
              e.stopPropagation();
              handleRemoveSkill(skill.skill_id, skill.skill?.name || 'skill');
            }}
            disabled={isRemoving}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {isRemoving ? (
              <ActivityIndicator size="small" color={theme.colors.error} />
            ) : (
              <Ionicons name="close" size={14} color={theme.colors.textSecondary} />
            )}
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  // Compact chip for learn skills
  const renderLearnChip = (skill: UserSkillWantWithDetails) => {
    const isRemoving = removingSkillId === skill.skill_id;

    return (
      <TouchableOpacity
        key={skill.id}
        style={[styles.skillChip, styles.learnChip]}
        onPress={() => setSelectedSkill({ type: 'learn', skill })}
        activeOpacity={0.7}
      >
        <Ionicons
          name={(skill.skill?.icon || 'star-outline') as any}
          size={14}
          color="#2196F3"
        />
        <Text style={[styles.chipText, styles.learnChipText]} numberOfLines={1}>
          {skill.skill?.name}
        </Text>
        {isEditing && (
          <TouchableOpacity
            style={styles.chipRemove}
            onPress={(e) => {
              e.stopPropagation();
              handleRemoveSkillWant(skill.skill_id, skill.skill?.name || 'skill');
            }}
            disabled={isRemoving}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {isRemoving ? (
              <ActivityIndicator size="small" color={theme.colors.error} />
            ) : (
              <Ionicons name="close" size={14} color={theme.colors.textSecondary} />
            )}
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  // Skill Detail Modal
  const renderSkillDetailModal = () => {
    if (!selectedSkill) return null;

    const isTeach = selectedSkill.type === 'teach';
    const skill = selectedSkill.skill;
    const skillInfo = skill.skill;
    const levelInfo = isTeach ? getSkillLevel((skill as UserSkillWithDetails).level) : null;
    const badge = isTeach ? (skill as UserSkillWithDetails).badge : null;

    return (
      <Modal
        visible={!!selectedSkill}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedSkill(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedSkill(null)}
        >
          <View style={styles.detailModal}>
            <TouchableOpacity activeOpacity={1}>
              {/* Header */}
              <View style={styles.detailHeader}>
                <View style={[
                  styles.detailIconContainer,
                  { backgroundColor: isTeach ? theme.colors.primary + '15' : '#2196F3' + '15' }
                ]}>
                  <Ionicons
                    name={(skillInfo?.icon || 'star-outline') as any}
                    size={32}
                    color={isTeach ? theme.colors.primary : '#2196F3'}
                  />
                </View>
                <View style={styles.detailHeaderInfo}>
                  <Text style={styles.detailSkillName}>{skillInfo?.name}</Text>
                  <Text style={styles.detailType}>
                    {isTeach ? 'Can Teach' : 'Want to Learn'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.detailCloseButton}
                  onPress={() => setSelectedSkill(null)}
                >
                  <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Level (for teach skills) */}
              {isTeach && levelInfo && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Level</Text>
                  <SkillLevelBadge level={(skill as UserSkillWithDetails).level} size="medium" />
                </View>
              )}

              {/* Badge (for teach skills) */}
              {badge && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Badge</Text>
                  <SkillBadgeDisplay
                    badgeLevel={badge.badge_level}
                    sessionsCompleted={badge.sessions_completed}
                    averageRating={badge.average_rating}
                    size="medium"
                    showDetails
                  />
                </View>
              )}

              {/* Description */}
              <View style={styles.detailDescriptionSection}>
                <Text style={styles.detailLabel}>Description</Text>
                <Text style={styles.detailDescription}>
                  {skill.description || 'No description provided'}
                </Text>
              </View>

              {/* Remove button (if editing) */}
              {isEditing && (
                <TouchableOpacity
                  style={styles.detailRemoveButton}
                  onPress={() => {
                    if (isTeach) {
                      handleRemoveSkill(skill.skill_id, skillInfo?.name || 'skill');
                    } else {
                      handleRemoveSkillWant(skill.skill_id, skillInfo?.name || 'skill');
                    }
                  }}
                >
                  <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
                  <Text style={styles.detailRemoveText}>Remove Skill</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  if (loading && mySkills.length === 0 && mySkillWants.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  }

  // Ultra compact mode - just show counts with expand option
  if (compactMode && !isEditing) {
    const totalSkills = mySkills.length + mySkillWants.length;
    if (totalSkills === 0) return null;

    return (
      <>
        <TouchableOpacity
          style={styles.compactContainer}
          onPress={toggleTeachSection}
          activeOpacity={0.7}
        >
          <View style={styles.compactRow}>
            <Ionicons name="school-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.compactText}>
              {mySkills.length} skill{mySkills.length !== 1 ? 's' : ''} to teach
            </Text>
            <Text style={styles.compactDivider}>•</Text>
            <Ionicons name="book-outline" size={18} color="#2196F3" />
            <Text style={styles.compactText}>
              {mySkillWants.length} to learn
            </Text>
            <Ionicons
              name={teachExpanded ? "chevron-up" : "chevron-down"}
              size={16}
              color={theme.colors.textSecondary}
            />
          </View>

          {teachExpanded && (
            <View style={styles.compactExpanded}>
              {mySkills.length > 0 && (
                <View style={styles.chipContainer}>
                  {mySkills.map(renderTeachChip)}
                </View>
              )}
              {mySkillWants.length > 0 && (
                <View style={[styles.chipContainer, { marginTop: 8 }]}>
                  {mySkillWants.map(renderLearnChip)}
                </View>
              )}
            </View>
          )}
        </TouchableOpacity>
        {renderSkillDetailModal()}
      </>
    );
  }

  return (
    <View style={styles.container}>
      {/* Skills I Can Teach - Collapsible */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={toggleTeachSection}
          activeOpacity={0.7}
        >
          <View style={styles.sectionTitleRow}>
            <Ionicons name="school-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Can Teach</Text>
            {mySkills.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{mySkills.length}</Text>
              </View>
            )}
          </View>
          <View style={styles.headerRight}>
            {isEditing && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={(e) => {
                  e.stopPropagation();
                  setShowTeachModal(true);
                }}
              >
                <Ionicons name="add" size={18} color={theme.colors.primary} />
              </TouchableOpacity>
            )}
            <Ionicons
              name={teachExpanded ? "chevron-up" : "chevron-down"}
              size={18}
              color={theme.colors.textSecondary}
            />
          </View>
        </TouchableOpacity>

        {teachExpanded && (
          <View style={styles.sectionContent}>
            {mySkills.length > 0 ? (
              <View style={styles.chipContainer}>
                {mySkills.map(renderTeachChip)}
              </View>
            ) : (
              <TouchableOpacity
                style={styles.emptyState}
                onPress={() => isEditing && setShowTeachModal(true)}
                disabled={!isEditing}
              >
                <Ionicons name="add-circle-outline" size={20} color={theme.colors.textSecondary} />
                <Text style={styles.emptyText}>
                  {isEditing ? 'Add skills you can teach' : 'No skills added'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Skills I Want to Learn - Collapsible */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={toggleLearnSection}
          activeOpacity={0.7}
        >
          <View style={styles.sectionTitleRow}>
            <Ionicons name="book-outline" size={18} color="#2196F3" />
            <Text style={styles.sectionTitle}>Want to Learn</Text>
            {mySkillWants.length > 0 && (
              <View style={[styles.countBadge, styles.learnCountBadge]}>
                <Text style={[styles.countText, styles.learnCountText]}>{mySkillWants.length}</Text>
              </View>
            )}
          </View>
          <View style={styles.headerRight}>
            {isEditing && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={(e) => {
                  e.stopPropagation();
                  setShowLearnModal(true);
                }}
              >
                <Ionicons name="add" size={18} color={theme.colors.primary} />
              </TouchableOpacity>
            )}
            <Ionicons
              name={learnExpanded ? "chevron-up" : "chevron-down"}
              size={18}
              color={theme.colors.textSecondary}
            />
          </View>
        </TouchableOpacity>

        {learnExpanded && (
          <View style={styles.sectionContent}>
            {mySkillWants.length > 0 ? (
              <View style={styles.chipContainer}>
                {mySkillWants.map(renderLearnChip)}
              </View>
            ) : (
              <TouchableOpacity
                style={styles.emptyState}
                onPress={() => isEditing && setShowLearnModal(true)}
                disabled={!isEditing}
              >
                <Ionicons name="add-circle-outline" size={20} color={theme.colors.textSecondary} />
                <Text style={styles.emptyText}>
                  {isEditing ? 'Add skills you want to learn' : 'No skills added'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Modals */}
      <SkillSelectionModal
        visible={showTeachModal}
        onClose={() => setShowTeachModal(false)}
        onSelect={handleAddTeachSkill}
        mode="teach"
        existingSkillIds={mySkills.map(s => s.skill_id)}
      />

      <SkillSelectionModal
        visible={showLearnModal}
        onClose={() => setShowLearnModal(false)}
        onSelect={handleAddLearnSkill}
        mode="learn"
        existingSkillIds={mySkillWants.map(s => s.skill_id)}
      />

      {renderSkillDetailModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.sm,
    width: '100%',
  },
  loadingContainer: {
    padding: theme.spacing.md,
    alignItems: 'center',
    width: '100%',
  },
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    width: '100%',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
  countBadge: {
    backgroundColor: theme.colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 4,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  learnCountBadge: {
    backgroundColor: '#2196F3' + '20',
  },
  learnCountText: {
    color: '#2196F3',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: theme.colors.primary + '15',
  },
  sectionContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    width: '100%',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
  },
  skillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary + '10',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  learnChip: {
    backgroundColor: '#2196F3' + '10',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.primary,
    maxWidth: 120,
  },
  learnChipText: {
    color: '#2196F3',
  },
  levelDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipRemove: {
    marginLeft: 2,
  },
  emptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.sm,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  // Compact mode styles
  compactContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    width: '100%',
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactText: {
    fontSize: 13,
    color: theme.colors.text,
  },
  compactDivider: {
    color: theme.colors.textSecondary,
    marginHorizontal: 4,
  },
  compactExpanded: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  // Detail Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  detailModal: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    width: '100%',
    maxWidth: 340,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  detailIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailHeaderInfo: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  detailSkillName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  detailType: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  detailCloseButton: {
    padding: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  detailDescriptionSection: {
    marginTop: theme.spacing.md,
  },
  detailDescription: {
    fontSize: 14,
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
    lineHeight: 20,
  },
  detailRemoveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    gap: 8,
  },
  detailRemoveText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.error,
  },
});
