import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { supabase } from '../integrations/supabase/client';
import { Tables } from '../integrations/supabase/types';

const DEFAULT_AVATAR = 'https://ui-avatars.com/api/?background=FF1744&color=fff&size=100';

interface SkillReviewModalProps {
  visible: boolean;
  onClose: () => void;
  session: (Tables<'skill_exchange_sessions'> & {
    teacher?: { id: string; name: string; photos: string[] | null };
    skill?: Tables<'skills'>;
  }) | null;
  onSubmitted: () => void;
}

export default function SkillReviewModal({
  visible,
  onClose,
  session,
  onSubmitted,
}: SkillReviewModalProps) {
  const [teachingQuality, setTeachingQuality] = useState(0);
  const [punctuality, setPunctuality] = useState(0);
  const [knowledgeLevel, setKnowledgeLevel] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [wouldRecommend, setWouldRecommend] = useState(true);
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setTeachingQuality(0);
    setPunctuality(0);
    setKnowledgeLevel(0);
    setReviewText('');
    setWouldRecommend(true);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!session) return;

    if (teachingQuality === 0 || punctuality === 0 || knowledgeLevel === 0) {
      Alert.alert('Error', 'Please rate all categories');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const { error } = await supabase.from('skill_reviews').insert({
        session_id: session.id,
        reviewer_id: user.id,
        reviewed_user_id: session.teacher_id,
        skill_id: session.skill_id,
        teaching_quality: teachingQuality,
        punctuality,
        knowledge_level: knowledgeLevel,
        review_text: reviewText.trim() || null,
        would_recommend: wouldRecommend,
      });

      if (error) throw error;

      Alert.alert('Thank You!', 'Your review has been submitted.', [
        { text: 'OK', onPress: () => {
          handleClose();
          onSubmitted();
        }}
      ]);
    } catch (error: any) {
      console.error('Error submitting review:', error);
      Alert.alert('Error', error.message || 'Failed to submit review');
    } finally {
      setLoading(false);
    }
  };

  const getTeacherAvatar = () => {
    if (session?.teacher?.photos && session.teacher.photos.length > 0) {
      return session.teacher.photos[0];
    }
    return `${DEFAULT_AVATAR}&name=${encodeURIComponent(session?.teacher?.name || 'User')}`;
  };

  const renderStars = (
    value: number,
    onChange: (value: number) => void,
    label: string
  ) => (
    <View style={styles.ratingRow}>
      <Text style={styles.ratingLabel}>{label}</Text>
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => onChange(star)}
            style={styles.starButton}
          >
            <Ionicons
              name={star <= value ? 'star' : 'star-outline'}
              size={28}
              color={star <= value ? '#FFD700' : theme.colors.gray[300]}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  if (!session) return null;

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
          <Text style={styles.headerTitle}>Rate Your Session</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Teacher Info */}
          <View style={styles.teacherCard}>
            <Image source={{ uri: getTeacherAvatar() }} style={styles.teacherAvatar} />
            <View>
              <Text style={styles.teacherName}>{session.teacher?.name}</Text>
              <Text style={styles.skillName}>Taught: {session.skill?.name}</Text>
            </View>
          </View>

          {/* Ratings */}
          <View style={styles.ratingsSection}>
            {renderStars(teachingQuality, setTeachingQuality, 'Teaching Quality')}
            {renderStars(punctuality, setPunctuality, 'Punctuality')}
            {renderStars(knowledgeLevel, setKnowledgeLevel, 'Knowledge Level')}
          </View>

          {/* Written Review */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Review (optional)</Text>
            <TextInput
              style={styles.reviewInput}
              placeholder="Share your experience learning from this teacher..."
              placeholderTextColor={theme.colors.textSecondary}
              value={reviewText}
              onChangeText={setReviewText}
              multiline
              numberOfLines={4}
              maxLength={500}
            />
            <Text style={styles.charCount}>{reviewText.length}/500</Text>
          </View>

          {/* Would Recommend */}
          <View style={styles.recommendSection}>
            <Text style={styles.recommendLabel}>
              Would you recommend {session.teacher?.name} as a teacher?
            </Text>
            <View style={styles.recommendOptions}>
              <TouchableOpacity
                style={[
                  styles.recommendOption,
                  wouldRecommend && styles.recommendOptionSelected,
                ]}
                onPress={() => setWouldRecommend(true)}
              >
                <Ionicons
                  name="thumbs-up"
                  size={24}
                  color={wouldRecommend ? theme.colors.success : theme.colors.textSecondary}
                />
                <Text
                  style={[
                    styles.recommendText,
                    wouldRecommend && styles.recommendTextSelected,
                  ]}
                >
                  Yes
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.recommendOption,
                  !wouldRecommend && styles.recommendOptionSelectedNo,
                ]}
                onPress={() => setWouldRecommend(false)}
              >
                <Ionicons
                  name="thumbs-down"
                  size={24}
                  color={!wouldRecommend ? theme.colors.error : theme.colors.textSecondary}
                />
                <Text
                  style={[
                    styles.recommendText,
                    !wouldRecommend && styles.recommendTextSelectedNo,
                  ]}
                >
                  No
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="white" />
                <Text style={styles.submitButtonText}>Submit Review</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
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
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  teacherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  teacherAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: theme.colors.primary + '30',
  },
  teacherName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  skillName: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  ratingsSection: {
    marginBottom: theme.spacing.lg,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  ratingLabel: {
    fontSize: 15,
    color: theme.colors.text,
    fontWeight: '500',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  starButton: {
    padding: 2,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  reviewInput: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: 15,
    color: theme.colors.text,
    minHeight: 120,
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
  recommendSection: {
    marginBottom: theme.spacing.xl,
  },
  recommendLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  recommendOptions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  recommendOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: theme.colors.border,
    gap: 8,
  },
  recommendOptionSelected: {
    borderColor: theme.colors.success,
    backgroundColor: theme.colors.success + '10',
  },
  recommendOptionSelectedNo: {
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.error + '10',
  },
  recommendText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  recommendTextSelected: {
    color: theme.colors.success,
  },
  recommendTextSelectedNo: {
    color: theme.colors.error,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.xl,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
