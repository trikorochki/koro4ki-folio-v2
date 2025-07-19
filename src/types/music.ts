// src/types/music.ts - ИСПРАВЛЕНО
export interface Track {
  id: string;
  number: number;
  title: string;
  originalTitle: string;
  file: string;
  duration: string;
  albumId: string;
  artistId: string;
}

export interface Album {
  id: string;
  title: string;
  type: 'Albums' | 'EPs' | 'Demos';
  cover: string;
  tracks: Track[];
  artistId: string;
}

export interface Artist {
  id: string;
  name: string;
  avatar: string;
  descriptionLine1: string;
  descriptionLine2: string;
  socialLinks: {
    telegram?: string;
    vk?: string;
    youtube?: string;
    soundcloud?: string;
  };
  Albums: Album[];     // ✅ Исправлено: заглавная буква
  EPs: Album[];        // ✅ Исправлено: заглавная буква  
  Demos: Album[];      // ✅ Исправлено: заглавная буква
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
