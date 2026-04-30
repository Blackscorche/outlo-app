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
import AppLoading from './AppLoading';
import { SKILL_LEVELS, SkillLevelId } from '../constants/skillTypes';
import { useSkills, SkillWithCategory } from '../hooks/useSkills';
import { Tables } from '../integrations/supabase/types';
import { useTheme } from '../contexts/ThemeContext';

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
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: t.spacing.md,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: t.colors.primary,
  },
  progressDotInactive: {
    backgroundColor: t.colors.gray[300],
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: t.colors.gray[300],
    marginHorizontal: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: t.spacing.lg,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: t.colors.text,
    marginBottom: t.spacing.lg,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: t.spacing.md,
    gap: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: t.colors.text,
    fontWeight: '500',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.md,
  },
  categoryCard: {
    width: '47%',
    backgroundColor: t.colors.surface,
    borderRadius: t.borderRadius.lg,
    padding: t.spacing.lg,
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
    backgroundColor: t.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: t.spacing.sm,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: t.colors.text,
    textAlign: 'center',
  },
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.sm,
  },
  skillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  skillChipText: {
    fontSize: 15,
    color: t.colors.text,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: t.spacing.xl,
  },
  emptyText: {
    fontSize: 16,
    color: t.colors.textSecondary,
    textAlign: 'center',
    marginTop: t.spacing.md,
  },
  selectedSkillBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.colors.primary + '10',
    padding: t.spacing.md,
    borderRadius: t.borderRadius.md,
    marginBottom: t.spacing.lg,
    gap: t.spacing.md,
  },
  selectedSkillIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: t.colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedSkillName: {
    fontSize: 18,
    fontWeight: '600',
    color: t.colors.text,
  },
  selectedSkillCategory: {
    fontSize: 14,
    color: t.colors.textSecondary,
  },
  section: {
    marginBottom: t.spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: t.colors.text,
    marginBottom: t.spacing.sm,
  },
  levelOptions: {
    gap: t.spacing.sm,
  },
  levelOption: {
    backgroundColor: t.colors.surface,
    borderRadius: t.borderRadius.md,
    padding: t.spacing.md,
    borderWidth: 2,
    borderColor: t.colors.border,
  },
  levelOptionSelected: {
    borderColor: t.colors.primary,
    backgroundColor: t.colors.primary + '10',
  },
  levelOptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: t.colors.text,
    marginBottom: 2,
  },
  levelOptionLabelSelected: {
    color: t.colors.primary,
  },
  levelOptionDesc: {
    fontSize: 13,
    color: t.colors.textSecondary,
  },
  levelOptionDescSelected: {
    color: t.colors.primary,
  },
  descriptionInput: {
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
  confirmButton: {
    backgroundColor: t.colors.primary,
    borderRadius: t.borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: t.spacing.md,
    marginBottom: t.spacing.xl,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
