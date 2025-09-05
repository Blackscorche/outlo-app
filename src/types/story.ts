
export interface Story {
  id: string;
  user_id: string;
  content: string | null;
  image_url: string | null;
  story_type: 'post' | 'selfie' | 'checkin';
  location_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  created_at: string;
  expires_at: string | null;
  profile?: {
    name: string;
    photos: string[];
  };
  likes?: Array<{ id: string; user_id: string; profile?: { name: string } }>;
  comments?: Array<{ 
    id: string; 
    user_id: string; 
    content: string; 
    created_at: string;
    profile?: { name: string; photos: string[] };
  }>;
}

export interface CreateStoryData {
  content?: string;
  image_url?: string;
  story_type: 'post' | 'selfie' | 'checkin';
  location_name?: string;
  location_lat?: number;
  location_lng?: number;
}

export interface UpdateStoryData {
  content?: string;
  image_url?: string;
  location_name?: string;
  location_lat?: number;
  location_lng?: number;
}
