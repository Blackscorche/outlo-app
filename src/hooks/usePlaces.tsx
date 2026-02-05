import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../integrations/supabase/client';
import { Tables } from '../integrations/supabase/types';

export type Place = Tables<'places'> & {
  reviews?: PlaceReview[];
  recent_check_ins?: number;
  nearby_activities?: number;
};

export type PlaceReview = Tables<'place_reviews'> & {
  user?: {
    id: string;
    name: string;
    photos: string[] | null;
  };
  has_marked_helpful?: boolean;
};

interface CreateReviewData {
  place_id: string;
  rating: number;
  review_text?: string;
  tags?: Record<string, boolean>;
  best_for?: string[];
  check_in_id?: string;
}

interface FindOrCreatePlaceData {
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  place_type?: string;
}

export function usePlaces() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Fetch places within a bounding box (for map view)
  const fetchPlacesInArea = useCallback(async (
    minLat: number,
    maxLat: number,
    minLon: number,
    maxLon: number,
    filters?: {
      placeType?: string;
      minRating?: number;
      tags?: string[];
    }
  ): Promise<Place[]> => {
    try {
      setLoading(true);

      let query = supabase
        .from('places')
        .select('*')
        .gte('latitude', minLat)
        .lte('latitude', maxLat)
        .gte('longitude', minLon)
        .lte('longitude', maxLon)
        .order('review_count', { ascending: false })
        .limit(50);

      if (filters?.placeType) {
        query = query.eq('place_type', filters.placeType);
      }

      if (filters?.minRating) {
        query = query.gte('average_rating', filters.minRating);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (mountedRef.current) {
        setPlaces(data || []);
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching places:', error);
      return [];
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Fetch nearby places based on user location
  const fetchNearbyPlaces = useCallback(async (
    latitude: number,
    longitude: number,
    radiusKm: number = 5,
    filters?: {
      placeType?: string;
      minRating?: number;
    }
  ): Promise<Place[]> => {
    // Calculate approximate bounding box
    const latDelta = radiusKm / 111; // ~111km per degree latitude
    const lonDelta = radiusKm / (111 * Math.cos(latitude * Math.PI / 180));

    return fetchPlacesInArea(
      latitude - latDelta,
      latitude + latDelta,
      longitude - lonDelta,
      longitude + lonDelta,
      filters
    );
  }, [fetchPlacesInArea]);

  // Get a single place by ID with reviews
  const getPlaceById = useCallback(async (placeId: string): Promise<Place | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Fetch place
      const { data: place, error: placeError } = await supabase
        .from('places')
        .select('*')
        .eq('id', placeId)
        .single();

      if (placeError) throw placeError;
      if (!place) return null;

      // Fetch reviews with user info
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('place_reviews')
        .select('*')
        .eq('place_id', placeId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (reviewsError) throw reviewsError;

      // Fetch user profiles for reviews
      let reviews: PlaceReview[] = [];
      if (reviewsData && reviewsData.length > 0) {
        const userIds = [...new Set(reviewsData.map(r => r.user_id))];
        const { data: usersData } = await supabase
          .from('profiles')
          .select('id, name, photos')
          .in('id', userIds);

        const usersMap = new Map(usersData?.map(u => [u.id, u]) || []);

        // Check which reviews user has marked as helpful
        let helpfulReviewIds: string[] = [];
        if (user) {
          const { data: helpfulData } = await supabase
            .from('review_helpful')
            .select('review_id')
            .eq('user_id', user.id)
            .in('review_id', reviewsData.map(r => r.id));

          helpfulReviewIds = helpfulData?.map(h => h.review_id) || [];
        }

        reviews = reviewsData.map(review => ({
          ...review,
          user: usersMap.get(review.user_id) || undefined,
          has_marked_helpful: helpfulReviewIds.includes(review.id),
        }));
      }

      // Count recent check-ins (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: recentCheckIns } = await supabase
        .from('check_ins')
        .select('*', { count: 'exact', head: true })
        .eq('location_name', place.name)
        .gte('created_at', oneDayAgo)
        .eq('is_active', true);

      // Count nearby activities
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const threshold = 0.001; // ~100 meters
      const { count: nearbyActivities } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open')
        .gte('scheduled_at', twoHoursAgo)
        .gte('latitude', place.latitude - threshold)
        .lte('latitude', place.latitude + threshold)
        .gte('longitude', place.longitude - threshold)
        .lte('longitude', place.longitude + threshold);

      return {
        ...place,
        reviews,
        recent_check_ins: recentCheckIns || 0,
        nearby_activities: nearbyActivities || 0,
      };
    } catch (error) {
      console.error('Error fetching place:', error);
      return null;
    }
  }, []);

  // Find or create a place based on location
  const findOrCreatePlace = useCallback(async (data: FindOrCreatePlaceData): Promise<string | null> => {
    try {
      const threshold = 0.0001; // ~11 meters

      // First try to find existing place
      const { data: existingPlaces, error: searchError } = await supabase
        .from('places')
        .select('id, name')
        .gte('latitude', data.latitude - threshold)
        .lte('latitude', data.latitude + threshold)
        .gte('longitude', data.longitude - threshold)
        .lte('longitude', data.longitude + threshold)
        .limit(5);

      if (searchError) throw searchError;

      // Check if any existing place matches the name
      const matchingPlace = existingPlaces?.find(p =>
        p.name.toLowerCase() === data.name.toLowerCase()
      );

      if (matchingPlace) {
        return matchingPlace.id;
      }

      // If very close place exists, return that
      if (existingPlaces && existingPlaces.length > 0) {
        return existingPlaces[0].id;
      }

      // Create new place
      const { data: newPlace, error: createError } = await supabase
        .from('places')
        .insert({
          name: data.name,
          latitude: data.latitude,
          longitude: data.longitude,
          address: data.address || null,
          place_type: data.place_type || 'other',
        })
        .select('id')
        .single();

      if (createError) throw createError;

      return newPlace?.id || null;
    } catch (error) {
      console.error('Error finding/creating place:', error);
      return null;
    }
  }, []);

  // Create a review for a place
  const createReview = useCallback(async (data: CreateReviewData): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to write a review');
        return false;
      }

      // Check if user already reviewed this place
      const { data: existingReview } = await supabase
        .from('place_reviews')
        .select('id')
        .eq('place_id', data.place_id)
        .eq('user_id', user.id)
        .single();

      if (existingReview) {
        // Update existing review
        const { error } = await supabase
          .from('place_reviews')
          .update({
            rating: data.rating,
            review_text: data.review_text || null,
            tags: data.tags || {},
            best_for: data.best_for || [],
            check_in_id: data.check_in_id || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingReview.id);

        if (error) throw error;
      } else {
        // Create new review
        const { error } = await supabase
          .from('place_reviews')
          .insert({
            place_id: data.place_id,
            user_id: user.id,
            rating: data.rating,
            review_text: data.review_text || null,
            tags: data.tags || {},
            best_for: data.best_for || [],
            check_in_id: data.check_in_id || null,
          });

        if (error) throw error;
      }

      return true;
    } catch (error) {
      console.error('Error creating review:', error);
      Alert.alert('Error', 'Failed to submit review');
      return false;
    }
  }, []);

  // Delete a review
  const deleteReview = useCallback(async (reviewId: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in');
        return false;
      }

      const { error } = await supabase
        .from('place_reviews')
        .delete()
        .eq('id', reviewId)
        .eq('user_id', user.id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting review:', error);
      Alert.alert('Error', 'Failed to delete review');
      return false;
    }
  }, []);

  // Mark a review as helpful
  const markReviewHelpful = useCallback(async (reviewId: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in');
        return false;
      }

      // Check if already marked
      const { data: existing } = await supabase
        .from('review_helpful')
        .select('id')
        .eq('review_id', reviewId)
        .eq('user_id', user.id)
        .single();

      if (existing) {
        // Remove helpful mark
        const { error } = await supabase
          .from('review_helpful')
          .delete()
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Add helpful mark
        const { error } = await supabase
          .from('review_helpful')
          .insert({
            review_id: reviewId,
            user_id: user.id,
          });

        if (error) throw error;
      }

      return true;
    } catch (error) {
      console.error('Error marking review helpful:', error);
      return false;
    }
  }, []);

  // Search places by name
  const searchPlaces = useCallback(async (query: string): Promise<Place[]> => {
    try {
      if (!query.trim()) return [];

      const { data, error } = await supabase
        .from('places')
        .select('*')
        .ilike('name', `%${query}%`)
        .order('review_count', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error searching places:', error);
      return [];
    }
  }, []);

  // Get user's review for a place
  const getUserReview = useCallback(async (placeId: string): Promise<PlaceReview | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('place_reviews')
        .select('*')
        .eq('place_id', placeId)
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
      return data || null;
    } catch (error) {
      console.error('Error fetching user review:', error);
      return null;
    }
  }, []);

  return {
    places,
    loading,
    refreshing,
    fetchPlacesInArea,
    fetchNearbyPlaces,
    getPlaceById,
    findOrCreatePlace,
    createReview,
    deleteReview,
    markReviewHelpful,
    searchPlaces,
    getUserReview,
  };
}
