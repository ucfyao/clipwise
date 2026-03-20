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
};
