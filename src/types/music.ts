// src/types/music.ts
export interface Track {
  id: string;
  title: string;
  file: string; // Прямой URL из Blob Storage
  duration: string;
  artistId: string;
  albumName?: string;
  number?: number; // Номер трека
  originalTitle?: string; // Оригинальное название
  albumId?: string; // ID альбома
  metadata?: {
    pathname: string;
    fileName: string;
    size: number;
    uploadedAt: string;
    number?: number;
    originalTitle?: string;
  };
}

export interface Album {
  id: string;
  title: string;
  type: 'Albums' | 'EPs' | 'Demos';
  cover?: string;
  tracks: Track[];
  artistId: string;
}

export interface Artist {
  id: string;
  name: string;
  avatar?: string;
  descriptionLine1?: string;
  descriptionLine2?: string;
  socialLinks?: {
    telegram?: string;
    vk?: string;
    youtube?: string;
    soundcloud?: string;
  };
  Albums: Album[];
  EPs: Album[];
  Demos: Album[];
}

export interface PlaylistData {
  [artistId: string]: Artist;
}

export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: 'off' | 'one' | 'all';
  queue: Track[];
  currentIndex: number;
}

export interface AnalyticsEvent {
  trackId: string;
  timestamp: number;
  userAgent: string;
  ip: string;
  country: string;
  device: string;
  os: string;
  browser: string;
}

export interface BlobTrackData {
  id: string;
  pathname: string;
  url: string;
  artistId: string;
  albumName: string;
  fileName: string;
  title: string;
  size: number;
  uploadedAt: string;
}

export interface BlobResponse {
  success: boolean;
  total: number;
  tracks: BlobTrackData[];
}
