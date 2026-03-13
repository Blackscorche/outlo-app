import { Ionicons } from '@expo/vector-icons';

export const ACTIVITY_TYPES = [
  { id: 'coffee', label: 'Coffee Meetup', icon: 'cafe-outline' as const, color: '#8D6E63' },
  { id: 'study', label: 'Study Session', icon: 'book-outline' as const, color: '#1E88E5' },
  { id: 'running', label: 'Running/Jogging', icon: 'fitness-outline' as const, color: '#F4511E' },
  { id: 'sports', label: 'Sports Activity', icon: 'basketball-outline' as const, color: '#FB8C00' },
  { id: 'creative', label: 'Creative Meetup', icon: 'color-palette-outline' as const, color: '#D81B60' },
  { id: 'dining', label: 'Dining Together', icon: 'restaurant-outline' as const, color: '#E53935' },
  { id: 'music', label: 'Music/Concert', icon: 'musical-notes-outline' as const, color: '#8E24AA' },
  { id: 'photography', label: 'Photography Walk', icon: 'camera-outline' as const, color: '#00ACC1' },
  { id: 'yoga', label: 'Yoga/Meditation', icon: 'leaf-outline' as const, color: '#43A047' },
  { id: 'networking', label: 'Networking', icon: 'briefcase-outline' as const, color: '#3949AB' },
  { id: 'gaming', label: 'Gaming', icon: 'game-controller-outline' as const, color: '#5E35B1' },
  { id: 'language', label: 'Language Exchange', icon: 'chatbubbles-outline' as const, color: '#00897B' },
  { id: 'hangout', label: 'Just Hanging Out', icon: 'people-outline' as const, color: '#F57C00' },
] as const;

export type ActivityTypeId = typeof ACTIVITY_TYPES[number]['id'];
export type ActivityType = typeof ACTIVITY_TYPES[number];

// Helper function to get activity type info by id
export const getActivityType = (id: string): ActivityType | undefined =>
  ACTIVITY_TYPES.find(type => type.id === id);

// Get icon name for activity type (with filled variant for selected state)
export const getActivityIcon = (id: string, filled = false): keyof typeof Ionicons.glyphMap => {
  const type = getActivityType(id);
  if (!type) return filled ? 'help-circle' : 'help-circle-outline';

  // Convert outline to filled version
  if (filled && type.icon.endsWith('-outline')) {
    return type.icon.replace('-outline', '') as keyof typeof Ionicons.glyphMap;
  }
  return type.icon;
};
