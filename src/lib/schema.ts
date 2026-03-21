export type TaskStatus = "pending" | "transcribing" | "analyzing" | "processing" | "completed" | "failed";
export type TaskMode = "clean" | "highlights" | "both";

export interface Task {
  id: string;
  filename: string;
  filepath: string;
  mode: TaskMode;
  status: TaskStatus;
  progress: number; // 0-100
  current_step: string;
  config: string; // JSON string of TaskConfig
  result: string | null; // JSON string of TaskResult
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskConfig {
  silence_threshold: number;
  keep_fillers: boolean;
  subtitle_style: "default" | "large-center";
  burn_subtitles: boolean;
  trim?: { start: number; end: number };
  normalize_audio: boolean;
  denoise: "off" | "light" | "medium" | "strong";
  speed: 1 | 1.25 | 1.5 | 2;
  fade: { enabled: boolean; duration: number };
}

export interface TaskResult {
  cleaned_video?: string;
  subtitle_file?: string; // ASS file (animated)
  srt_file?: string;      // SRT file (plain)
  clips?: Array<{
    title: string;
    filepath: string;
    subtitle_file: string;
    duration: number;
    score: number;
  }>;
  copy?: Array<{
    clip_title: string;
    platforms: Array<{
      platform: string;
      title: string;
      description: string;
      hashtags: string[];
    }>;
  }>;
}

export const DEFAULT_CONFIG: TaskConfig = {
  silence_threshold: 3,
  keep_fillers: false,
  subtitle_style: "default",
  burn_subtitles: false,
  normalize_audio: false,
  denoise: "off",
  speed: 1,
  fade: { enabled: false, duration: 1 },
};

// --- Timeline & SSE types ---

export interface TimelineSegment {
  start: number;
  end: number;
  type: "speech" | "silence" | "filler" | "keep";
  reason?: string;
}

export interface TimelineClip {
  start: number;
  end: number;
  title: string;
  score: number;
}

// SSE typed events (segments/clips only — regular task updates have no type field)
export type SSETypedEvent =
  | { type: "segments"; data: TimelineSegment[] }
  | { type: "clips"; data: TimelineClip[] };

export type PageStatus = "idle" | "uploaded" | "processing" | "done" | "failed";

// --- Export tool types ---

export interface ExportRequest {
  tool: "thumbnail" | "gif" | "audio" | "compress";
  options: ThumbnailOptions | GIFOptions | AudioOptions | CompressOptions;
}

export interface ThumbnailOptions {
  time?: number;
}

export interface GIFOptions {
  start: number;
  duration: number;
  width?: number;
}

export interface AudioOptions {
  format: "mp3" | "aac";
}

export interface CompressOptions {
  quality: "high" | "medium" | "low";
}
