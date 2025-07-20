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
  cover?: string; // Прямой URL из Blob Storage или пустая строка
  tracks: Track[];
  artistId: string;
}

export interface Artist {
  id: string;
  name: string;
  avatar?: string; // Путь к локальному изображению в public/images
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

// ================================================================================
// ENHANCED BLOB STORAGE API INTERFACES
// ================================================================================

export interface BlobTrackData {
  id: string;
  pathname: string;
  url: string; // Прямой HTTPS URL из Vercel Blob Storage
  artistId: string;
  albumName: string;
  fileName: string;
  title: string;
  size: number;
  uploadedAt: string;
  // Добавляем недостающие поля для совместимости с Track интерфейсом
  number?: number;
  originalTitle?: string;
  albumId?: string;
  duration?: string;
  metadata?: {
    pathname: string;
    fileName: string;
    size: number;
    uploadedAt: string;
    number?: number;
    originalTitle?: string;
  };
}

export interface BlobResponse {
  success: boolean;
  total: number;
  tracks: BlobTrackData[];
  // Добавляем поля для обработки ошибок и отладки
  error?: string;
  debug?: {
    totalBlobs: number;
    audioFiles: number;
    validTracks: number;
    processingTime: number;
  };
}

// ================================================================================
// ENHANCED API RESPONSE INTERFACES
// ================================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  details?: string;
  code?: number;
  timestamp: string;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
  total?: number;
  timestamp?: string;
}

// ================================================================================
// MUSIC METADATA INTERFACES
// ================================================================================

export interface TrackMetadata {
  pathname: string;
  fileName: string;
  size: number;
  uploadedAt: string;
  number?: number;
  originalTitle?: string;
  // Дополнительные метаданные
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
  format?: string;
  codec?: string;
}

export interface AlbumMetadata {
  year?: number;
  genre?: string;
  label?: string;
  producer?: string;
  totalTracks?: number;
  totalDuration?: string;
}

export interface ArtistMetadata {
  country?: string;
  genre?: string[];
  foundedYear?: number;
  members?: string[];
  website?: string;
}

// ================================================================================
// ENHANCED TYPES
// ================================================================================

export type ReleaseType = 'Albums' | 'EPs' | 'Demos';
export type RepeatMode = 'off' | 'one' | 'all';
export type DeviceType = 'Mobile' | 'Desktop' | 'Tablet';
export type AudioFormat = 'mp3' | 'wav' | 'flac' | 'm4a' | 'ogg' | 'aac';
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';
export type PlaybackState = 'playing' | 'paused' | 'stopped' | 'loading';

// ================================================================================
// ERROR HANDLING INTERFACES
// ================================================================================

export interface AudioError {
  name: string;
  message: string;
  code?: number;
  trackId?: string;
  timestamp?: number;
}

export interface NetworkError extends Error {
  code: 'NETWORK_ERROR';
  status?: number;
  statusText?: string;
}

export interface ValidationError extends Error {
  code: 'VALIDATION_ERROR';
  field?: string;
  value?: any;
}

// ================================================================================
// CACHING INTERFACES
// ================================================================================

export interface DurationCacheEntry {
  trackId: string;
  duration: string;
  timestamp: number;
  lastAccessed?: number;
}

export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  expiresAt?: number;
  lastAccessed?: number;
}

export interface Cache<T> {
  get(key: string): T | null;
  set(key: string, value: T, ttl?: number): void;
  delete(key: string): boolean;
  clear(): void;
  size(): number;
}

// ================================================================================
// HOOK INTERFACES
// ================================================================================

export interface UseTracksOptions {
  enableAutoRefresh?: boolean;
  refreshInterval?: number;
  retryOnError?: boolean;
  maxRetries?: number;
}

export interface UseTracksReturn {
  tracks: Track[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  totalTracks: number;
  hasError: boolean;
  isReady: boolean;
}

export interface UseMusicPlayerReturn {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  queue: Track[];
  currentIndex: number;
  playTrack: (track: Track) => void;
  pauseTrack: () => void;
  resumeTrack: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setCurrentTime: (time: number) => void;
  setVolume: (volume: number) => void;
  setShuffle: (shuffle: boolean) => void;
  setRepeat: (repeat: RepeatMode) => void;
  setQueue: (tracks: Track[]) => void;
  shuffleAndPlay: (tracks: Track[]) => void;
  clearQueue: () => void;
  findTrackIndex: (trackId: string) => number;
  updateTrackDuration: (trackId: string, duration: string) => void;
}

// ================================================================================
// COMPONENT PROPS INTERFACES
// ================================================================================

export interface PlayButtonProps {
  tracks: Track[];
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'header' | 'artist' | 'album';
  className?: string;
  disabled?: boolean;
  showText?: boolean;
}

export interface TrackListProps {
  tracks: Track[];
  showAlbumInfo?: boolean;
  compact?: boolean;
  showArtist?: boolean;
  onTrackSelect?: (track: Track) => void;
  currentTrack?: Track;
}

export interface AlbumCarouselProps {
  albums: Album[];
  layout?: 'vertical' | 'horizontal';
  showFullTrackList?: boolean;
  maxTracksPreview?: number;
}

export interface ArtistGridProps {
  artists: Artist[];
  columns?: number;
  showStats?: boolean;
}

// ================================================================================
// ANALYTICS AND STATS INTERFACES
// ================================================================================

export interface PlaybackAnalytics {
  trackId: string;
  event: 'play' | 'pause' | 'skip' | 'complete' | '30s_listen';
  timestamp: string;
  duration?: number;
  position?: number;
  userAgent?: string;
  sessionId?: string;
}

export interface TrackStats {
  trackId: string;
  playCount: number;
  skipCount: number;
  completionRate: number;
  avgListenTime: number;
  lastPlayed?: string;
}

export interface ArtistStats {
  artistId: string;
  totalPlays: number;
  totalTracks: number;
  totalReleases: number;
  topTrack?: Track;
  avgRating?: number;
}

// ================================================================================
// SEARCH AND FILTER INTERFACES
// ================================================================================

export interface SearchQuery {
  query: string;
  filters?: {
    artist?: string;
    album?: string;
    year?: number;
    genre?: string;
    releaseType?: ReleaseType;
  };
  sortBy?: 'relevance' | 'date' | 'title' | 'artist' | 'plays';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface SearchResults {
  tracks: Track[];
  artists: Artist[];
  albums: Album[];
  total: number;
  query: string;
  executionTime: number;
}

// ================================================================================
// UTILITY TYPE HELPERS
// ================================================================================

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Типы для состояний загрузки
export type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastUpdated?: number;
};

// Типы для пагинации
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// ================================================================================
// CONFIGURATION INTERFACES
// ================================================================================

export interface MusicPlayerConfig {
  autoplay?: boolean;
  shuffleByDefault?: boolean;
  defaultVolume?: number;
  enableAnalytics?: boolean;
  enableCache?: boolean;
  cacheSize?: number;
  crossfadeDuration?: number;
  preloadNext?: boolean;
  enableEqualizer?: boolean;
}

export interface AudioProcessingConfig {
  gainNode?: boolean;
  compressor?: boolean;
  reverb?: boolean;
  echo?: boolean;
  bassBoost?: boolean;
}

// ================================================================================
// QUEUE MANAGEMENT INTERFACES
// ================================================================================

export interface QueueItem {
  track: Track;
  queuedAt: number;
  source: 'user' | 'auto' | 'recommendation';
  priority?: number;
}

export interface PlayQueue {
  items: QueueItem[];
  currentIndex: number;
  history: Track[];
  shuffle: boolean;
  repeat: RepeatMode;
}

// ================================================================================
// EXPORT HELPERS
// ================================================================================

// Re-export commonly used types for convenience
export type {
  Track as MusicTrack,
  Album as MusicAlbum,
  Artist as MusicArtist,
  PlayerState as MusicPlayerState
};

// Type guards for runtime validation
export const isTrack = (obj: any): obj is Track => {
  return obj && typeof obj.id === 'string' && typeof obj.title === 'string' && typeof obj.file === 'string';
};

export const isAlbum = (obj: any): obj is Album => {
  return obj && typeof obj.id === 'string' && typeof obj.title === 'string' && Array.isArray(obj.tracks);
};

export const isArtist = (obj: any): obj is Artist => {
  return obj && typeof obj.id === 'string' && typeof obj.name === 'string';
};

export const isBlobTrackData = (obj: any): obj is BlobTrackData => {
  return obj && typeof obj.id === 'string' && typeof obj.url === 'string' && typeof obj.title === 'string';
};
