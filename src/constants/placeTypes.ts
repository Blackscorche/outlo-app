// Place types for categorizing locations
export const PLACE_TYPES = [
  { id: 'cafe', label: 'Cafe', icon: 'cafe-outline' },
  { id: 'restaurant', label: 'Restaurant', icon: 'restaurant-outline' },
  { id: 'bar', label: 'Bar', icon: 'wine-outline' },
  { id: 'park', label: 'Park', icon: 'leaf-outline' },
  { id: 'gym', label: 'Gym', icon: 'fitness-outline' },
  { id: 'library', label: 'Library', icon: 'library-outline' },
  { id: 'museum', label: 'Museum', icon: 'business-outline' },
  { id: 'theater', label: 'Theater', icon: 'film-outline' },
  { id: 'mall', label: 'Shopping Mall', icon: 'bag-outline' },
  { id: 'beach', label: 'Beach', icon: 'sunny-outline' },
  { id: 'mountain', label: 'Mountain', icon: 'trail-sign-outline' },
  { id: 'coworking', label: 'Coworking Space', icon: 'laptop-outline' },
  { id: 'hotel', label: 'Hotel', icon: 'bed-outline' },
  { id: 'club', label: 'Club', icon: 'musical-notes-outline' },
  { id: 'other', label: 'Other', icon: 'location-outline' },
] as const;

export const getPlaceType = (id: string) =>
  PLACE_TYPES.find(type => type.id === id) || PLACE_TYPES.find(t => t.id === 'other');

export const getPlaceIcon = (id: string) =>
  getPlaceType(id)?.icon || 'location-outline';

// Review tags - characteristics of a place
export const REVIEW_TAGS = [
  { id: 'great_for_meetups', label: 'Great for meetups' },
  { id: 'study_friendly', label: 'Study-friendly' },
  { id: 'romantic_atmosphere', label: 'Romantic atmosphere' },
  { id: 'good_food', label: 'Good food' },
  { id: 'good_coffee', label: 'Good coffee' },
  { id: 'quiet', label: 'Quiet' },
  { id: 'noisy', label: 'Noisy' },
  { id: 'comfortable_seating', label: 'Comfortable seating' },
  { id: 'outdoor_seating', label: 'Outdoor seating' },
  { id: 'wifi_available', label: 'WiFi available' },
  { id: 'pet_friendly', label: 'Pet friendly' },
  { id: 'affordable', label: 'Affordable' },
  { id: 'upscale', label: 'Upscale' },
  { id: 'good_for_photos', label: 'Good for photos' },
  { id: 'late_night', label: 'Late night' },
] as const;

export const getReviewTag = (id: string) =>
  REVIEW_TAGS.find(tag => tag.id === id);

// Best for categories
export const BEST_FOR_OPTIONS = [
  { id: 'coffee_dates', label: 'Coffee dates', icon: 'cafe-outline' },
  { id: 'group_meetups', label: 'Group meetups', icon: 'people-outline' },
  { id: 'solo_work', label: 'Solo work', icon: 'laptop-outline' },
  { id: 'first_meetings', label: 'First meetings', icon: 'heart-outline' },
  { id: 'romantic_dinner', label: 'Romantic dinner', icon: 'restaurant-outline' },
  { id: 'casual_hangout', label: 'Casual hangout', icon: 'happy-outline' },
  { id: 'business_meeting', label: 'Business meeting', icon: 'briefcase-outline' },
  { id: 'outdoor_activity', label: 'Outdoor activity', icon: 'sunny-outline' },
] as const;

export const getBestForOption = (id: string) =>
  BEST_FOR_OPTIONS.find(option => option.id === id);

// Place filters for search
export const PLACE_FILTERS = [
  { id: 'high_rated', label: 'High Rated', icon: 'star' },
  { id: 'study_friendly', label: 'Study Friendly', icon: 'book-outline' },
  { id: 'outdoor', label: 'Outdoor', icon: 'leaf-outline' },
  { id: 'popular_meetup', label: 'Popular Meetups', icon: 'people-outline' },
] as const;
