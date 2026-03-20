import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { getDb } from "@/lib/db";
import { Task, TaskConfig, TaskResult, DEFAULT_CONFIG } from "@/lib/schema";
import { UPLOADS_DIR, TRANSCRIPTS_DIR, OUTPUTS_DIR, TEMP_DIR } from "@/lib/constants";
import { transcribeVideo } from "./transcribe";
import { analyzeTranscript, analyzeTranscriptBasic, AnalysisResult } from "./analyze";
import { extractHighlights } from "./extract";
import { cleanVideo, extractClip } from "./ffmpeg";
import { generateSRT, generateAnimatedASS } from "./subtitle";
import { generateCopy } from "./copywriter";

// Ensure data directories exist
async function ensureDirs() {
  for (const dir of [UPLOADS_DIR, TRANSCRIPTS_DIR, OUTPUTS_DIR, TEMP_DIR]) {
    await fs.mkdir(dir, { recursive: true });
  }
}

// --- SSE listener management ---
const listeners = new Map<string, ((data: string) => void)[]>();

export function addSSEListener(taskId: string, cb: (data: string) => void) {
  if (!listeners.has(taskId)) listeners.set(taskId, []);
  listeners.get(taskId)!.push(cb);
}

export function removeSSEListener(taskId: string, cb: (data: string) => void) {
  const cbs = listeners.get(taskId);
  if (cbs) {
    const idx = cbs.indexOf(cb);
    if (idx >= 0) cbs.splice(idx, 1);
    if (cbs.length === 0) listeners.delete(taskId);
  }
}

function notifyListeners(taskId: string, data: object) {
  const cbs = listeners.get(taskId);
  if (cbs) {
    const msg = `data: ${JSON.stringify(data)}\n\n`;
    cbs.forEach((cb) => cb(msg));
  }
}

// --- DB helpers ---
function updateTask(id: string, updates: Partial<Task>) {
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    sets.push(`${key} = ?`);
    values.push(value);
  }
  sets.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  notifyListeners(id, { ...updates, id });
}

export function getTask(id: string): Task | undefined {
  return getDb().prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Task | undefined;
}

export function listTasks(): Task[] {
  return getDb().prepare("SELECT * FROM tasks ORDER BY created_at DESC").all() as Task[];
}

// --- Task lifecycle ---
export async function createTask(
  filename: string,
  filepath: string,
  mode: string,
  config: TaskConfig = DEFAULT_CONFIG
): Promise<string> {
  await ensureDirs();
  const id = randomUUID();
  const db = getDb();

  db.prepare(
    `INSERT INTO tasks (id, filename, filepath, mode, config) VALUES (?, ?, ?, ?, ?)`
  ).run(id, filename, filepath, mode, JSON.stringify(config));

  // Fire and forget — errors are caught and stored in DB
  processTask(id).catch((err) => {
    console.error(`Task ${id} failed:`, err);
    updateTask(id, { status: "failed", error: err.message });
  });

  return id;
}

export async function retryTask(id: string) {
  updateTask(id, { status: "pending", progress: 0, error: null, current_step: "" });
  processTask(id).catch((err) => {
    updateTask(id, { status: "failed", error: err.message });
  });
}

// --- Processing pipeline ---
// Progress mapping: 0-30% transcription, 30-50% analysis, 50-75% FFmpeg clean, 75-95% clips, 95-100% done
async function processTask(taskId: string) {
  const db = getDb();
  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as Task;
  if (!task) throw new Error("Task not found");

  const config: TaskConfig = JSON.parse(task.config);
  const result: TaskResult = {};

  try {
    // === Pre-step: Trim video if configured ===
    let videoPath = task.filepath;
    if (config.trim) {
      updateTask(taskId, { current_step: "裁剪视频..." });
      const trimmedPath = path.join(TEMP_DIR, `${taskId}-trimmed.mp4`);
      const { spawn } = await import("child_process");
      await new Promise<void>((resolve, reject) => {
        const proc = spawn("ffmpeg", [
          "-y", "-i", videoPath,
          "-ss", config.trim!.start.toString(),
          "-to", config.trim!.end.toString(),
          "-c", "copy",
          "-avoid_negative_ts", "make_zero",
          trimmedPath,
        ], { stdio: ["pipe", "pipe", "pipe"] });
        let stderr = "";
        proc.stderr.on("data", (c: Buffer) => { stderr += c.toString(); });
        proc.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`FFmpeg trim failed: ${stderr.slice(-300)}`));
        });
      });
      videoPath = trimmedPath;
    }

    // === Step 1: Transcribe ===
    updateTask(taskId, { status: "transcribing", progress: 5, current_step: "Transcribing audio..." });

    const transcriptPath = await transcribeVideo(videoPath, taskId, (data) => {
      const pct = Math.min(Math.floor(data.progress * 0.3), 30);
      updateTask(taskId, { progress: pct, current_step: "Transcribing audio..." });
    });

    // === Step 2: Feature A — Clean ===
    if (task.mode === "clean" || task.mode === "both") {
      const hasApiKey = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== "sk-ant-xxx";

      let analysis: AnalysisResult;
      if (hasApiKey) {
        updateTask(taskId, { status: "analyzing", progress: 35, current_step: "Analyzing content with AI..." });
        analysis = await analyzeTranscript(
          transcriptPath,
          config.silence_threshold,
          config.keep_fillers
        );
      } else {
        updateTask(taskId, { status: "analyzing", progress: 35, current_step: "Detecting silence (basic mode)..." });
        analysis = await analyzeTranscriptBasic(
          transcriptPath,
          config.silence_threshold
        );
      }

      updateTask(taskId, { progress: 50, current_step: "Generating subtitles..." });
      const srtPath = await generateSRT(analysis.segments, path.join(OUTPUTS_DIR, `${taskId}.srt`));
      result.srt_file = srtPath;

      // Also generate animated ASS subtitle
      const assPath = await generateAnimatedASS(transcriptPath, path.join(OUTPUTS_DIR, `${taskId}.ass`), config.subtitle_style);
      result.subtitle_file = assPath; // Prefer ASS over SRT

      updateTask(taskId, { status: "processing", progress: 55, current_step: "Cleaning video..." });
      const cleanedPath = await cleanVideo(
        videoPath,
        analysis.segments,
        taskId,
        config.burn_subtitles,
        srtPath
      );
      result.cleaned_video = cleanedPath;
    }

    // === Step 3: Feature B — Highlights (requires API key) ===
    const hasApiKeyForHighlights = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== "sk-ant-xxx";
    if ((task.mode === "highlights" || task.mode === "both") && hasApiKeyForHighlights) {
      updateTask(taskId, { progress: 70, current_step: "Extracting highlights..." });

      const highlights = await extractHighlights(transcriptPath);

      updateTask(taskId, { status: "processing", progress: 75, current_step: "Cutting clips..." });
      result.clips = [];

      for (let i = 0; i < highlights.clips.length; i++) {
        const clip = highlights.clips[i];
        const pct = 75 + Math.floor((i / highlights.clips.length) * 20);
        updateTask(taskId, { progress: pct, current_step: `Cutting clip ${i + 1}/${highlights.clips.length}...` });

        const clipPath = await extractClip(videoPath, clip, taskId, i);

        // Generate subtitle for this clip
        const clipSrtPath = path.join(OUTPUTS_DIR, `${taskId}-clip${i}.srt`);
        const clipSegments = [{
          start: 0,
          end: clip.end - clip.start,
          type: "keep" as const,
          text: clip.title,
        }];
        await generateSRT(clipSegments, clipSrtPath);

        result.clips.push({
          title: clip.title,
          filepath: clipPath,
          subtitle_file: clipSrtPath,
          duration: clip.end - clip.start,
          score: clip.score,
        });
      }

      // Generate platform-specific copy for each clip
      if (hasApiKeyForHighlights) {
        updateTask(taskId, { progress: 93, current_step: "生成发布文案..." });
        try {
          const copy = await generateCopy(
            highlights.clips.map(c => ({ title: c.title, start: c.start, end: c.end, reason: c.reason })),
            task.filename
          );
          result.copy = copy;
        } catch {
          // Non-critical — continue without copy
        }
      }
    }

    // === Done ===
    updateTask(taskId, {
      status: "completed",
      progress: 100,
      current_step: "Done!",
      result: JSON.stringify(result),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    updateTask(taskId, { status: "failed", error: message, current_step: "Failed" });
    throw err;
  }
}
