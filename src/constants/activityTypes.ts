import { Ionicons } from '@expo/vector-icons';

// Activity types for the Activity Hub feature
// Extends the check-in activity tags with scheduled activity-specific options
export const ACTIVITY_TYPES = [
  { id: 'coffee', label: 'Coffee Meetup', icon: 'cafe-outline' as const },
  { id: 'study', label: 'Study Session', icon: 'book-outline' as const },
  { id: 'running', label: 'Running/Jogging', icon: 'fitness-outline' as const },
  { id: 'sports', label: 'Sports Activity', icon: 'basketball-outline' as const },
  { id: 'creative', label: 'Creative Meetup', icon: 'color-palette-outline' as const },
  { id: 'dining', label: 'Dining Together', icon: 'restaurant-outline' as const },
  { id: 'music', label: 'Music/Concert', icon: 'musical-notes-outline' as const },
  { id: 'photography', label: 'Photography Walk', icon: 'camera-outline' as const },
  { id: 'yoga', label: 'Yoga/Meditation', icon: 'leaf-outline' as const },
  { id: 'networking', label: 'Networking', icon: 'briefcase-outline' as const },
  { id: 'gaming', label: 'Gaming', icon: 'game-controller-outline' as const },
  { id: 'language', label: 'Language Exchange', icon: 'chatbubbles-outline' as const },
  { id: 'hangout', label: 'Just Hanging Out', icon: 'people-outline' as const },
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
