export interface User {
  id: string;
  name: string;
  age: number;
  bio: string;
  photos: string[];
  interests: string[];
  location: {
    lat: number;
    lng: number;
  };
  isOnline: boolean;
  distance: number;
  gender: 'male' | 'female' | 'unknown';
  lookingFor?: 'men' | 'women' | 'everyone';
  occupation?: string;
  education?: string;
  jobTitle?: string;
  company?: string;
  school?: string;
  maxDistance?: number;
  ageRangeMin?: number;
  ageRangeMax?: number;
  statusText?: string;
  coverPhoto?: string;
  hasRealLocation?: boolean;
  relationshipGoals?: string;
  livingIn?: string;
  isVerified?: boolean;
  lastSeen?: Date;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: Date;
  read: boolean;
}

export interface Match {
  id: string;
  users: string[];
  createdAt: Date;
  lastMessage?: Message;
}
