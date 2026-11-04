export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  role: string;
  plan: string;
  createdAt?: any;
}

export interface UserPreferences {
  id?: string;
  userId: string;
  autoplay: boolean;
  crossfadeSeconds: number;
  normalizeVolume: boolean;
  audioQuality: string;
  explicitContentFilter: boolean;
  language: string;
}

export interface Artist {
  id: string;
  name: string;
  bio?: string | null;
  avatarUrl: string;
  headerUrl?: string | null;
  verified: boolean;
  monthlyListeners: number;
  rankGlobal?: number | null;
  albums?: Album[];
  tracks?: Track[];
  createdAt?: any;
}

export interface Album {
  id: string;
  title: string;
  coverUrl: string;
  releaseYear: number;
  releaseDate?: string | null;
  type: string;
  copyright?: string | null;
  artistId: string;
  artist?: Artist;
  genreId?: string | null;
  genre?: Genre | null;
  tracks?: Track[];
  createdAt?: any;
}

export interface Track {
  id: string;
  title: string;
  duration: number; // in seconds
  streamCount: number;
  audioUrl: string;
  ytId?: string | null;
  source?: string | null;
  lyrics?: string | null;
  explicit: boolean;
  trackNumber: number;
  discNumber: number;
  albumId: string;
  album?: Album;
  artistId: string;
  artist?: Artist;
  genreId?: string | null;
  genre?: Genre | null;
  createdAt?: any;
  likedAt?: any;
  addedAt?: any;
}

export interface Genre {
  id: string;
  name: string;
  slug: string;
  colorHex: string;
  imageUrl?: string | null;
}

export interface Playlist {
  id: string;
  title: string;
  description?: string | null;
  coverUrl?: string | null;
  isPublic: boolean;
  ownerId: string;
  owner?: User;
  tracks?: {
    id: string;
    position: number;
    addedAt: any;
    track: Track;
  }[];
  createdAt?: any;
  updatedAt?: any;
}

export interface PlayHistoryItem {
  id: string;
  trackId: string;
  track: Track;
  playedAt: any;
}
