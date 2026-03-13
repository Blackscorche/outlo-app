export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      ai_phrases: {
        Row: {
          category: string
          created_at: string
          id: string
          phrase: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          phrase: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          phrase?: string
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          chat_room_id: string
          created_at: string
          id: string
          message: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          chat_room_id: string
          created_at?: string
          id?: string
          message: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          chat_room_id?: string
          created_at?: string
          id?: string
          message?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_chat_room_id_fkey"
            columns: ["chat_room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rooms: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user1_id: string
          user2_id: string
          last_message?: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user1_id: string
          user2_id: string
          last_message?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user1_id?: string
          user2_id?: string
          last_message?: string | null
        }
        Relationships: []
      }
      connection_requests: {
        Row: {
          created_at: string
          id: string
          receiver_id: string
          seen_by_receiver: boolean
          sender_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          receiver_id: string
          seen_by_receiver?: boolean
          sender_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          receiver_id?: string
          seen_by_receiver?: boolean
          sender_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      connections: {
        Row: {
          created_at: string
          id: string
          user1_id: string
          user2_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user1_id: string
          user2_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user1_id?: string
          user2_id?: string
        }
        Relationships: []
      }
      friends: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          created_at: string
          id: string
          user1_id: string
          user2_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user1_id: string
          user2_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user1_id?: string
          user2_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          chat_room_id: string
          sender_id: string
          content: string
          created_at: string
          is_read: boolean
        }
        Insert: {
          id?: string
          chat_room_id: string
          sender_id: string
          content: string
          created_at?: string
          is_read?: boolean
        }
        Update: {
          id?: string
          chat_room_id?: string
          sender_id?: string
          content?: string
          created_at?: string
          is_read?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_room_id_fkey"
            columns: ["chat_room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age: number
          age_range_max: number | null
          age_range_min: number | null
          bio: string | null
          company: string | null
          created_at: string
          current_latitude: number | null
          current_location_name: string | null
          current_longitude: number | null
          education: string | null
          gender: string | null
          id: string
          interests: string[] | null
          is_online: boolean | null
          is_verified: boolean | null
          job_title: string | null
          last_seen: string | null
          living_in: string | null
          location: string | null
          location_updated_at: string | null
          looking_for: string | null
          max_distance: number | null
          name: string
          occupation: string | null
          photos: string[] | null
          relationship_goals: string | null
          school: string | null
          show_on_map: boolean | null
          status_text: string | null
          updated_at: string
        }
        Insert: {
          age: number
          age_range_max?: number | null
          age_range_min?: number | null
          bio?: string | null
          company?: string | null
          created_at?: string
          current_latitude?: number | null
          current_location_name?: string | null
          current_longitude?: number | null
          education?: string | null
          gender?: string | null
          id: string
          interests?: string[] | null
          is_online?: boolean | null
          is_verified?: boolean | null
          job_title?: string | null
          last_seen?: string | null
          living_in?: string | null
          location?: string | null
          location_updated_at?: string | null
          looking_for?: string | null
          max_distance?: number | null
          name: string
          occupation?: string | null
          photos?: string[] | null
          relationship_goals?: string | null
          school?: string | null
          show_on_map?: boolean | null
          status_text?: string | null
          updated_at?: string
        }
        Update: {
          age?: number
          age_range_max?: number | null
          age_range_min?: number | null
          bio?: string | null
          company?: string | null
          created_at?: string
          current_latitude?: number | null
          current_location_name?: string | null
          current_longitude?: number | null
          education?: string | null
          gender?: string | null
          id?: string
          interests?: string[] | null
          is_online?: boolean | null
          is_verified?: boolean | null
          job_title?: string | null
          last_seen?: string | null
          living_in?: string | null
          location?: string | null
          location_updated_at?: string | null
          looking_for?: string | null
          max_distance?: number | null
          name?: string
          occupation?: string | null
          photos?: string[] | null
          relationship_goals?: string | null
          school?: string | null
          show_on_map?: boolean | null
          status_text?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stories: {
        Row: {
          content: string | null
          created_at: string
          expires_at: string | null
          id: string
          image_url: string | null
          location_lat: number | null
          location_lng: number | null
          location_name: string | null
          story_type: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          image_url?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_name?: string | null
          story_type?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          image_url?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_name?: string | null
          story_type?: string
          user_id?: string
        }
        Relationships: []
      }
      story_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_comments_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_likes: {
        Row: {
          created_at: string
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_likes_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscribers: {
        Row: {
          connect_requests_reset_date: string | null
          connect_requests_used: number | null
          created_at: string
          email: string
          id: string
          stripe_customer_id: string | null
          subscribed: boolean
          subscription_end: string | null
          subscription_tier: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          connect_requests_reset_date?: string | null
          connect_requests_used?: number | null
          created_at?: string
          email: string
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          connect_requests_reset_date?: string | null
          connect_requests_used?: number | null
          created_at?: string
          email?: string
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      swipes: {
        Row: {
          created_at: string
          id: string
          liked: boolean
          swiped_id: string
          swiper_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          liked: boolean
          swiped_id: string
          swiper_id: string
        }
        Update: {
          created_at?: string
          id?: string
          liked?: boolean
          swiped_id?: string
          swiper_id?: string
        }
        Relationships: []
      }
      user_favorites: {
        Row: {
          created_at: string
          favorited_user_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          favorited_user_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          favorited_user_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      pinned_users: {
        Row: {
          created_at: string
          id: string
          pinned_user_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pinned_user_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pinned_user_id?: string
          user_id?: string
        }
        Relationships: []
      }
      activities: {
        Row: {
          id: string
          creator_id: string
          activity_type: string
          title: string
          description: string | null
          location_name: string
          latitude: number
          longitude: number
          scheduled_at: string
          max_participants: number
          current_participants: number
          status: 'open' | 'full' | 'completed' | 'cancelled'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          creator_id: string
          activity_type: string
          title: string
          description?: string | null
          location_name: string
          latitude: number
          longitude: number
          scheduled_at: string
          max_participants?: number
          current_participants?: number
          status?: 'open' | 'full' | 'completed' | 'cancelled'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          creator_id?: string
          activity_type?: string
          title?: string
          description?: string | null
          location_name?: string
          latitude?: number
          longitude?: number
          scheduled_at?: string
          max_participants?: number
          current_participants?: number
          status?: 'open' | 'full' | 'completed' | 'cancelled'
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      activity_participants: {
        Row: {
          id: string
          activity_id: string
          user_id: string
          status: 'joined' | 'left'
          joined_at: string
        }
        Insert: {
          id?: string
          activity_id: string
          user_id: string
          status?: 'joined' | 'left'
          joined_at?: string
        }
        Update: {
          id?: string
          activity_id?: string
          user_id?: string
          status?: 'joined' | 'left'
          joined_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_participants_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      activity_comments: {
        Row: {
          id: string
          activity_id: string
          user_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          activity_id: string
          user_id: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          activity_id?: string
          user_id?: string
          content?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_comments_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      places: {
        Row: {
          id: string
          name: string
          latitude: number
          longitude: number
          address: string | null
          place_type: string
          average_rating: number
          review_count: number
          check_in_count: number
          activity_count: number
          tags: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          latitude: number
          longitude: number
          address?: string | null
          place_type: string
          average_rating?: number
          review_count?: number
          check_in_count?: number
          activity_count?: number
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          latitude?: number
          longitude?: number
          address?: string | null
          place_type?: string
          average_rating?: number
          review_count?: number
          check_in_count?: number
          activity_count?: number
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      place_reviews: {
        Row: {
          id: string
          place_id: string
          user_id: string
          check_in_id: string | null
          rating: number
          review_text: string | null
          tags: Record<string, boolean>
          best_for: string[]
          photos: string[]
          helpful_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          place_id: string
          user_id: string
          check_in_id?: string | null
          rating: number
          review_text?: string | null
          tags?: Record<string, boolean>
          best_for?: string[]
          photos?: string[]
          helpful_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          place_id?: string
          user_id?: string
          check_in_id?: string | null
          rating?: number
          review_text?: string | null
          tags?: Record<string, boolean>
          best_for?: string[]
          photos?: string[]
          helpful_count?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_reviews_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_reviews_check_in_id_fkey"
            columns: ["check_in_id"]
            isOneToOne: false
            referencedRelation: "check_ins"
            referencedColumns: ["id"]
          }
        ]
      }
      review_helpful: {
        Row: {
          id: string
          review_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          review_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          review_id?: string
          user_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_helpful_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "place_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_helpful_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      verification_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_url: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      skill_categories: {
        Row: {
          id: string
          name: string
          icon: string
          display_order: number
          created_at: string
        }
        Insert: {
          id: string
          name: string
          icon: string
          display_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          icon?: string
          display_order?: number
          created_at?: string
        }
        Relationships: []
      }
      skills: {
        Row: {
          id: string
          category_id: string
          name: string
          icon: string | null
          created_at: string
        }
        Insert: {
          id?: string
          category_id: string
          name: string
          icon?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          category_id?: string
          name?: string
          icon?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "skills_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "skill_categories"
            referencedColumns: ["id"]
          }
        ]
      }
      user_skills: {
        Row: {
          id: string
          user_id: string
          skill_id: string
          level: 'beginner' | 'intermediate' | 'advanced' | 'expert'
          description: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          skill_id: string
          level: 'beginner' | 'intermediate' | 'advanced' | 'expert'
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          skill_id?: string
          level?: 'beginner' | 'intermediate' | 'advanced' | 'expert'
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_skills_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          }
        ]
      }
      user_skill_wants: {
        Row: {
          id: string
          user_id: string
          skill_id: string
          description: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          skill_id: string
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          skill_id?: string
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_skill_wants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_skill_wants_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          }
        ]
      }
      skill_exchange_proposals: {
        Row: {
          id: string
          proposer_id: string
          receiver_id: string
          skill_to_learn_id: string
          skill_to_offer_id: string | null
          location_name: string
          latitude: number
          longitude: number
          proposed_date: string
          duration_minutes: number
          message: string | null
          status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'completed'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          proposer_id: string
          receiver_id: string
          skill_to_learn_id: string
          skill_to_offer_id?: string | null
          location_name: string
          latitude: number
          longitude: number
          proposed_date: string
          duration_minutes?: number
          message?: string | null
          status?: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'completed'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          proposer_id?: string
          receiver_id?: string
          skill_to_learn_id?: string
          skill_to_offer_id?: string | null
          location_name?: string
          latitude?: number
          longitude?: number
          proposed_date?: string
          duration_minutes?: number
          message?: string | null
          status?: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'completed'
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_exchange_proposals_proposer_id_fkey"
            columns: ["proposer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_exchange_proposals_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_exchange_proposals_skill_to_learn_id_fkey"
            columns: ["skill_to_learn_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_exchange_proposals_skill_to_offer_id_fkey"
            columns: ["skill_to_offer_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          }
        ]
      }
      skill_exchange_sessions: {
        Row: {
          id: string
          proposal_id: string
          teacher_id: string
          student_id: string
          skill_id: string
          session_date: string
          status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          proposal_id: string
          teacher_id: string
          student_id: string
          skill_id: string
          session_date: string
          status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          proposal_id?: string
          teacher_id?: string
          student_id?: string
          skill_id?: string
          session_date?: string
          status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_exchange_sessions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "skill_exchange_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_exchange_sessions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_exchange_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_exchange_sessions_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          }
        ]
      }
      skill_reviews: {
        Row: {
          id: string
          session_id: string
          reviewer_id: string
          reviewed_user_id: string
          skill_id: string
          teaching_quality: number
          punctuality: number
          knowledge_level: number
          review_text: string | null
          would_recommend: boolean
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          reviewer_id: string
          reviewed_user_id: string
          skill_id: string
          teaching_quality: number
          punctuality: number
          knowledge_level: number
          review_text?: string | null
          would_recommend?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          reviewer_id?: string
          reviewed_user_id?: string
          skill_id?: string
          teaching_quality?: number
          punctuality?: number
          knowledge_level?: number
          review_text?: string | null
          would_recommend?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_reviews_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "skill_exchange_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_reviews_reviewed_user_id_fkey"
            columns: ["reviewed_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_reviews_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          }
        ]
      }
      skill_badges: {
        Row: {
          id: string
          user_id: string
          skill_id: string
          badge_level: 'bronze' | 'silver' | 'gold' | 'diamond'
          sessions_completed: number
          average_rating: number | null
          earned_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          skill_id: string
          badge_level: 'bronze' | 'silver' | 'gold' | 'diamond'
          sessions_completed?: number
          average_rating?: number | null
          earned_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          skill_id?: string
          badge_level?: 'bronze' | 'silver' | 'gold' | 'diamond'
          sessions_completed?: number
          average_rating?: number | null
          earned_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_badges_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      reset_monthly_connect_requests: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
