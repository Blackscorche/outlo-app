import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import AppLoading from './AppLoading';
import { SKILL_LEVELS, SkillLevelId } from '../constants/skillTypes';
import { useSkills, SkillWithCategory } from '../hooks/useSkills';
import { Tables } from '../integrations/supabase/types';

type SkillCategory = Tables<'skill_categories'>;

interface SkillSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (data: {
    skill_id: string;
    skill_name: string;
    level?: SkillLevelId;
    description?: string;
  }) => void;
  mode: 'teach' | 'learn';
  existingSkillIds?: string[];
}

export default function SkillSelectionModal({
  visible,
  onClose,
  onSelect,
  mode,
  existingSkillIds = [],
}: SkillSelectionModalProps) {
  const { categories, allSkills, loadingCategories, getSkillsByCategory } = useSkills();

  const [step, setStep] = useState<'category' | 'skill' | 'details'>('category');
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<SkillWithCategory | null>(null);
  const [level, setLevel] = useState<SkillLevelId>('intermediate');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (visible) {
      resetForm();
    }
  }, [visible]);

  const resetForm = () => {
    setStep('category');
    setSelectedCategory(null);
    setSelectedSkill(null);
    setLevel('intermediate');
    setDescription('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleCategorySelect = (category: SkillCategory) => {
    setSelectedCategory(category);
    setStep('skill');
  };

  const handleSkillSelect = (skill: SkillWithCategory) => {
    setSelectedSkill(skill);
    setStep('details');
  };

  const handleBack = () => {
    if (step === 'skill') {
      setStep('category');
      setSelectedCategory(null);
    } else if (step === 'details') {
      setStep('skill');
      setSelectedSkill(null);
    }
  };

  const handleConfirm = () => {
    if (!selectedSkill) return;

    onSelect({
      skill_id: selectedSkill.id,
      skill_name: selectedSkill.name,
      level: mode === 'teach' ? level : undefined,
      description: description.trim() || undefined,
    });

    handleClose();
  };

  const getCategoryIcon = (iconName: string) => {
    return iconName as keyof typeof Ionicons.glyphMap;
  };

  const filteredSkills = selectedCategory
    ? getSkillsByCategory(selectedCategory.id).filter(
        skill => !existingSkillIds.includes(skill.id)
      )
    : [];

  const renderCategorySelection = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Select a Category</Text>
      <View style={styles.categoriesGrid}>
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={styles.categoryCard}
            onPress={() => handleCategorySelect(category)}
            activeOpacity={0.7}
          >
            <View style={styles.categoryIconContainer}>
              <Ionicons
                name={getCategoryIcon(category.icon)}
                size={28}
                color={theme.colors.primary}
              />
            </View>
            <Text style={styles.categoryName}>{category.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  const renderSkillSelection = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={styles.backButton} onPress={handleBack}>
        <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
        <Text style={styles.backButtonText}>{selectedCategory?.name}</Text>
      </TouchableOpacity>

      <Text style={styles.stepTitle}>Select a Skill</Text>

      {filteredSkills.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle" size={48} color={theme.colors.success} />
          <Text style={styles.emptyText}>
            You've already added all skills from this category
          </Text>
        </View>
      ) : (
        <View style={styles.skillsGrid}>
          {filteredSkills.map((skill) => (
            <TouchableOpacity
              key={skill.id}
              style={styles.skillChip}
              onPress={() => handleSkillSelect(skill)}
              activeOpacity={0.7}
            >
              {skill.icon && (
                <Ionicons
                  name={getCategoryIcon(skill.icon)}
                  size={18}
                  color={theme.colors.primary}
                />
              )}
              <Text style={styles.skillChipText}>{skill.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );

  const renderDetailsForm = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={styles.backButton} onPress={handleBack}>
        <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>

      <View style={styles.selectedSkillBanner}>
        <View style={styles.selectedSkillIcon}>
          <Ionicons
            name={getCategoryIcon(selectedSkill?.icon || 'star-outline')}
            size={24}
            color={theme.colors.primary}
          />
        </View>
        <View>
          <Text style={styles.selectedSkillName}>{selectedSkill?.name}</Text>
          <Text style={styles.selectedSkillCategory}>
            {selectedCategory?.name}
          </Text>
        </View>
      </View>

      {mode === 'teach' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Skill Level</Text>
          <View style={styles.levelOptions}>
            {SKILL_LEVELS.map((levelOption) => (
              <TouchableOpacity
                key={levelOption.id}
                style={[
                  styles.levelOption,
                  level === levelOption.id && styles.levelOptionSelected,
                ]}
                onPress={() => setLevel(levelOption.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.levelOptionLabel,
                    level === levelOption.id && styles.levelOptionLabelSelected,
                  ]}
                >
                  {levelOption.label}
                </Text>
                <Text
                  style={[
                    styles.levelOptionDesc,
                    level === levelOption.id && styles.levelOptionDescSelected,
                  ]}
                >
                  {levelOption.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {mode === 'teach'
            ? 'Tell others about your experience (optional)'
            : 'What do you want to learn? (optional)'
          }
        </Text>
        <TextInput
          style={styles.descriptionInput}
          placeholder={
            mode === 'teach'
              ? 'e.g., "I have 5 years of experience and love teaching beginners"'
              : 'e.g., "I want to learn the basics and be able to play simple songs"'
          }
          placeholderTextColor={theme.colors.textSecondary}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          maxLength={200}
        />
        <Text style={styles.charCount}>{description.length}/200</Text>
      </View>

      <TouchableOpacity
        style={styles.confirmButton}
        onPress={handleConfirm}
        activeOpacity={0.8}
      >
        <Text style={styles.confirmButtonText}>
          {mode === 'teach' ? 'Add Skill' : 'Add to Learning List'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

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
          <Text style={styles.headerTitle}>
            {mode === 'teach' ? 'Add Skill to Teach' : 'Add Skill to Learn'}
          </Text>
          <View style={styles.headerRight} />
        </View>

        {/* Progress indicator */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressDot, step !== 'category' && styles.progressDotInactive]} />
          <View style={styles.progressLine} />
          <View style={[styles.progressDot, step === 'category' && styles.progressDotInactive]} />
          <View style={styles.progressLine} />
          <View style={[styles.progressDot, step !== 'details' && styles.progressDotInactive]} />
        </View>

        {loadingCategories ? (
          <View style={styles.loadingContainer}>
            <AppLoading />
          </View>
        ) : (
          <>
            {step === 'category' && renderCategorySelection()}
            {step === 'skill' && renderSkillSelection()}
            {step === 'details' && renderDetailsForm()}
          </>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  headerRight: {
    width: 32,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
  progressDotInactive: {
    backgroundColor: theme.colors.gray[300],
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: theme.colors.gray[300],
    marginHorizontal: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    gap: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: '500',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  categoryCard: {
    width: '47%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
  },
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  skillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  skillChipText: {
    fontSize: 15,
    color: theme.colors.text,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  selectedSkillBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary + '10',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  selectedSkillIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedSkillName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  selectedSkillCategory: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  levelOptions: {
    gap: theme.spacing.sm,
  },
  levelOption: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  levelOptionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '10',
  },
  levelOptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  levelOptionLabelSelected: {
    color: theme.colors.primary,
  },
  levelOptionDesc: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  levelOptionDescSelected: {
    color: theme.colors.primary,
  },
  descriptionInput: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: 15,
    color: theme.colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  charCount: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'right',
    marginTop: 4,
  },
  confirmButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
