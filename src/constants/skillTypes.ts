// Skill Exchange System - Types and Constants

// Skill levels
export const SKILL_LEVELS = [
  { id: 'beginner', label: 'Beginner', description: 'Just started, basic knowledge', color: '#4CAF50' },
  { id: 'intermediate', label: 'Intermediate', description: '1-2 years experience', color: '#2196F3' },
  { id: 'advanced', label: 'Advanced', description: '3-5 years experience', color: '#9C27B0' },
  { id: 'expert', label: 'Expert', description: '5+ years, can teach professionally', color: '#FF9800' },
] as const;

// Badge levels with thresholds
export const BADGE_LEVELS = [
  { id: 'bronze', label: 'Bronze', minSessions: 0, maxSessions: 5, color: '#CD7F32', icon: 'medal-outline' },
  { id: 'silver', label: 'Silver', minSessions: 6, maxSessions: 15, color: '#C0C0C0', icon: 'medal-outline' },
  { id: 'gold', label: 'Gold', minSessions: 16, maxSessions: 30, color: '#FFD700', icon: 'medal' },
  { id: 'diamond', label: 'Diamond', minSessions: 31, maxSessions: Infinity, color: '#B9F2FF', icon: 'diamond' },
] as const;

// Proposal statuses
export const PROPOSAL_STATUSES = [
  { id: 'pending', label: 'Pending', color: '#FFA500' },
  { id: 'accepted', label: 'Accepted', color: '#4CAF50' },
  { id: 'declined', label: 'Declined', color: '#F44336' },
  { id: 'cancelled', label: 'Cancelled', color: '#9E9E9E' },
  { id: 'completed', label: 'Completed', color: '#2196F3' },
] as const;

// Session statuses
export const SESSION_STATUSES = [
  { id: 'scheduled', label: 'Scheduled', color: '#2196F3' },
  { id: 'in_progress', label: 'In Progress', color: '#4CAF50' },
  { id: 'completed', label: 'Completed', color: '#9C27B0' },
  { id: 'cancelled', label: 'Cancelled', color: '#9E9E9E' },
  { id: 'no_show', label: 'No Show', color: '#F44336' },
] as const;

// Types
export type SkillLevelId = typeof SKILL_LEVELS[number]['id'];
export type BadgeLevelId = typeof BADGE_LEVELS[number]['id'];
export type ProposalStatusId = typeof PROPOSAL_STATUSES[number]['id'];
export type SessionStatusId = typeof SESSION_STATUSES[number]['id'];

// Skill category type (from database)
export interface SkillCategory {
  id: string;
  name: string;
  icon: string;
  display_order: number;
}

// Skill type (from database)
export interface Skill {
  id: string;
  category_id: string;
  name: string;
  icon: string | null;
}

// User skill type (skills they can teach)
export interface UserSkill {
  id: string;
  user_id: string;
  skill_id: string;
  level: SkillLevelId;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  skill?: Skill;
  category?: SkillCategory;
}

// User skill want type (skills they want to learn)
export interface UserSkillWant {
  id: string;
  user_id: string;
  skill_id: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  skill?: Skill;
  category?: SkillCategory;
}

// Skill exchange proposal
export interface SkillExchangeProposal {
  id: string;
  proposer_id: string;
  receiver_id: string;
  skill_to_learn_id: string;
  skill_to_offer_id: string | null;
  location_name: string;
  latitude: number;
  longitude: number;
  proposed_date: string;
  duration_minutes: number;
  message: string | null;
  status: ProposalStatusId;
  created_at: string;
  updated_at: string;
  // Joined data
  proposer?: {
    id: string;
    name: string;
    photos: string[];
  };
  receiver?: {
    id: string;
    name: string;
    photos: string[];
  };
  skill_to_learn?: Skill;
  skill_to_offer?: Skill;
}

// Skill exchange session
export interface SkillExchangeSession {
  id: string;
  proposal_id: string;
  teacher_id: string;
  student_id: string;
  skill_id: string;
  session_date: string;
  status: SessionStatusId;
  created_at: string;
  updated_at: string;
  // Joined data
  teacher?: {
    id: string;
    name: string;
    photos: string[];
  };
  student?: {
    id: string;
    name: string;
    photos: string[];
  };
  skill?: Skill;
  proposal?: SkillExchangeProposal;
}

// Skill review
export interface SkillReview {
  id: string;
  session_id: string;
  reviewer_id: string;
  reviewed_user_id: string;
  skill_id: string;
  teaching_quality: number;
  punctuality: number;
  knowledge_level: number;
  review_text: string | null;
  would_recommend: boolean;
  created_at: string;
  // Joined data
  reviewer?: {
    id: string;
    name: string;
    photos: string[];
  };
  skill?: Skill;
}

// Skill badge
export interface SkillBadge {
  id: string;
  user_id: string;
  skill_id: string;
  badge_level: BadgeLevelId;
  sessions_completed: number;
  average_rating: number | null;
  earned_at: string;
  updated_at: string;
  // Joined data
  skill?: Skill;
}

// Skill match (for matching screen)
export interface SkillMatch {
  user: {
    id: string;
    name: string;
    photos: string[];
    age?: number;
    bio?: string;
    latitude?: number;
    longitude?: number;
  };
  distance?: number;
  skills_can_teach: (UserSkill & { badge?: SkillBadge })[];
  skills_want_to_learn: UserSkillWant[];
  is_mutual_match: boolean;
  matching_teach_skills: string[]; // Skills they can teach that you want
  matching_learn_skills: string[]; // Skills you can teach that they want
}

// Helper functions
export const getSkillLevel = (id: string) =>
  SKILL_LEVELS.find(level => level.id === id);

export const getBadgeLevel = (sessionsCompleted: number) =>
  BADGE_LEVELS.find(badge =>
    sessionsCompleted >= badge.minSessions && sessionsCompleted <= badge.maxSessions
  ) || BADGE_LEVELS[0];

export const getBadgeLevelById = (id: string) =>
  BADGE_LEVELS.find(badge => badge.id === id);

export const getProposalStatus = (id: string) =>
  PROPOSAL_STATUSES.find(status => status.id === id);

export const getSessionStatus = (id: string) =>
  SESSION_STATUSES.find(status => status.id === id);

// Calculate average rating from review
export const calculateAverageRating = (review: SkillReview): number => {
  return (review.teaching_quality + review.punctuality + review.knowledge_level) / 3;
};

// Format badge display text
export const formatBadgeText = (badge: SkillBadge): string => {
  const level = getBadgeLevelById(badge.badge_level);
  return `${level?.label || badge.badge_level} Teacher`;
};

// Get emoji for badge level
export const getBadgeEmoji = (level: BadgeLevelId): string => {
  switch (level) {
    case 'bronze': return '🥉';
    case 'silver': return '🥈';
    case 'gold': return '🥇';
    case 'diamond': return '💎';
    default: return '🏅';
  }
};
