export interface VideoFormat {
  format_id: string;
  ext: string;
  height: number | null;
  fps: number | null;
  vcodec: string;
  acodec: string;
  filesize: number | null;
  tbr: number | null;
  format_note: string;
}

export interface VideoInfo {
  id: string;
  title: string;
  thumbnail: string | null;
  duration: number | null;
  duration_string: string | null;
  uploader: string;
  uploader_id: string;
  channel: string;
  channel_url: string;
  view_count: number | null;
  like_count: number | null;
  upload_date: string | null;
  description: string | null;
  categories: string[];
  tags: string[];
  extractor: string;
  extractor_key: string;
  webpage_url: string;
  webpage_url_domain: string;
  age_limit: number;
  live_status: string;
  formats: VideoFormat[];
  _fetched_at: number;
}

export interface QualityPreset {
  id: string;
  label: string;
  tag: string;
  size: string | null;
  formatId: string;
  type: "video" | "audio";
  audioFormat?: string;
}

export type QueueItemState = "pending" | "downloading" | "completed" | "failed";

export interface QueueProgress {
  percent: string;
  speed: string;
  eta: string;
}

export interface QueueItem {
  id: number;
  url: string;
  title: string;
  thumbnail: string | null;
  formatId: string;
  extractAudio: boolean;
  audioFormat: string;
  state: QueueItemState;
  error: string | null;
  progress: QueueProgress | null;
  addedAt: number;
}

export interface QueueCounts {
  total: number;
  pending: number;
  downloading: number;
  completed: number;
  failed: number;
}

export interface QueueUpdate {
  items: QueueItem[];
  counts: QueueCounts;
  isActive: boolean;
}

export interface FetchResult {
  info: VideoInfo;
  presets: QualityPreset[];
}

export interface AppInfo {
  version: string;
  devMode: boolean;
  platform: string;
  arch: string;
}

export interface DepStatus {
  found: boolean;
  path: string | null;
}

export interface DepsCheck {
  ytdlp: DepStatus;
  ffmpeg: DepStatus;
}

export type CookieBrowser = "chrome" | "firefox" | "safari" | "edge" | "brave" | "";

export interface DownloadOptions {
  // Subtitles
  writeSubs: boolean;
  embedSubs: boolean;
  subLangs: string; // e.g. "en,de" or "all"
  // Metadata
  embedThumbnail: boolean;
  embedMetadata: boolean;
  // SponsorBlock
  sponsorBlock: boolean;
  sponsorBlockCategories: string[]; // "sponsor","intro","outro","selfpromo","interaction","music_offtopic"
  // Bandwidth
  rateLimit: string; // e.g. "2M", "500K", "" = unlimited
  // Auth
  cookiesBrowser: CookieBrowser; // "" = disabled
}

export const DEFAULT_DOWNLOAD_OPTIONS: DownloadOptions = {
  writeSubs: false,
  embedSubs: false,
  subLangs: "en",
  embedThumbnail: false,
  embedMetadata: true,
  sponsorBlock: false,
  sponsorBlockCategories: ["sponsor"],
  rateLimit: "",
  cookiesBrowser: "",
};

export interface AddQueueItem {
  url: string;
  title: string;
  thumbnail: string | null;
  formatId: string;
  extractAudio: boolean;
  audioFormat: string;
}

export interface HistoryEntry {
  id: string; // video id
  url: string;
  title: string;
  thumbnail: string | null;
  uploader: string;
  duration_string: string | null;
  downloadedAt: number;
  formatLabel: string;
}

export interface PlaylistItem {
  id: string;
  title: string;
  url: string;
  duration: number | null;
  duration_string: string | null;
  thumbnail: string | null;
  uploader: string;
  _playlist_index: number;
}

export interface FetchPlaylistResult {
  items: PlaylistItem[];
}
