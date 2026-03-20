import path from "path";

export const DATA_DIR = path.join(process.cwd(), "data");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
export const TRANSCRIPTS_DIR = path.join(DATA_DIR, "transcripts");
export const OUTPUTS_DIR = path.join(DATA_DIR, "outputs");
export const TEMP_DIR = path.join(DATA_DIR, "temp");
export const DB_PATH = path.join(process.cwd(), "clipwise.db");

export const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
export const MAX_DURATION_MINUTES = 90;
export const DEFAULT_SILENCE_THRESHOLD = 3; // seconds
export const WORKER_DIR = path.join(process.cwd(), "worker");
