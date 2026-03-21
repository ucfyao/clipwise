import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { getTaskById, insertTask, updateTaskFields, listTasks as dbListTasks, deleteTask as dbDeleteTask } from "@/lib/db";
import { Task, TaskConfig, TaskResult, DEFAULT_CONFIG } from "@/lib/schema";
import type { TimelineSegment, TimelineClip } from "@/lib/schema";
import { UPLOADS_DIR, TRANSCRIPTS_DIR, OUTPUTS_DIR, TEMP_DIR } from "@/lib/constants";
import { transcribeVideo } from "./transcribe";
import { analyzeTranscript, analyzeTranscriptBasic, AnalysisResult } from "./analyze";
import { extractHighlights } from "./extract";
import { cleanVideo, extractClip } from "./ffmpeg";
import { generateSRT, generateAnimatedASS } from "./subtitle";
import { generateCopy } from "./copywriter";
import { hasAIKey } from "@/lib/ai";

// Ensure data directories exist
async function ensureDirs() {
  for (const dir of [UPLOADS_DIR, TRANSCRIPTS_DIR, OUTPUTS_DIR, TEMP_DIR]) {
    await fs.mkdir(dir, { recursive: true });
  }
}

// --- SSE listener management ---
// Use globalThis to survive HMR and ensure same instance across routes
const globalListeners = globalThis as unknown as { __clipwise_sse_listeners?: Map<string, ((data: string) => void)[]> };
if (!globalListeners.__clipwise_sse_listeners) {
  globalListeners.__clipwise_sse_listeners = new Map();
}
const listeners = globalListeners.__clipwise_sse_listeners;

export function addSSEListener(taskId: string, cb: (data: string) => void) {
  if (!listeners.has(taskId)) listeners.set(taskId, []);
  listeners.get(taskId)!.push(cb);
  console.log(`[SSE] Listener added for ${taskId}, total: ${listeners.get(taskId)!.length}`);
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
  if (cbs && cbs.length > 0) {
    const msg = `data: ${JSON.stringify(data)}\n\n`;
    cbs.forEach((cb) => cb(msg));
  } else {
    const dataType = (data as Record<string, unknown>).type || "update";
    console.log(`[SSE] No listeners for ${taskId} (event: ${dataType}), listeners map size: ${listeners.size}`);
  }
}

function notifySegments(taskId: string, segments: TimelineSegment[]) {
  notifyListeners(taskId, { type: "segments", data: segments });
}

function notifyClips(taskId: string, clips: TimelineClip[]) {
  notifyListeners(taskId, { type: "clips", data: clips });
}

function taskLog(taskId: string, message: string, level: "info" | "warn" | "error" = "info") {
  const now = new Date();
  const timestamp = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}.${now.getMilliseconds().toString().padStart(3, "0")}`;
  const line = `[${timestamp}] ${message}`;
  console.log(`[task:${taskId}] ${message}`);
  notifyListeners(taskId, { type: "log", level, message: line });
}

// --- Task helpers ---
function updateTask(id: string, updates: Partial<Task>) {
  updateTaskFields(id, updates);
  notifyListeners(id, { ...updates, id });
}

export function getTask(id: string): Task | undefined {
  return getTaskById(id);
}

export function listTasks(): Task[] {
  return dbListTasks();
}

export { dbDeleteTask as deleteTask };

// --- Task lifecycle ---
export async function createTask(
  filename: string,
  filepath: string,
  mode: string,
  config: TaskConfig = DEFAULT_CONFIG
): Promise<string> {
  await ensureDirs();
  const id = randomUUID();
  const now = new Date().toISOString();

  const task: Task = {
    id,
    filename,
    filepath,
    mode: mode as Task["mode"],
    status: "pending",
    progress: 0,
    current_step: "",
    config: JSON.stringify(config),
    result: null,
    error: null,
    created_at: now,
    updated_at: now,
  };

  insertTask(task);

  // Fire and forget — errors are caught and stored
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
  taskLog(taskId, "========== START PROCESSING ==========");
  const task = getTaskById(taskId);
  if (!task) throw new Error("Task not found");

  const config: TaskConfig = JSON.parse(task.config);
  const result: TaskResult = {};
  taskLog(taskId, `File: ${task.filename}`);
  taskLog(taskId, `Mode: ${task.mode}`);
  taskLog(taskId, `Config: ${JSON.stringify(config)}`);

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
    taskLog(taskId, "Step 1: Starting transcription...");
    taskLog(taskId, `Video: ${videoPath}`);
    updateTask(taskId, { status: "transcribing", progress: 5, current_step: "准备转录..." });

    const log = (msg: string, level?: "info" | "warn" | "error") => taskLog(taskId, msg, level);

    const transcriptPath = await transcribeVideo(videoPath, taskId, (data) => {
      const message = (data.message as string) || "转录中...";
      taskLog(taskId, `[whisper] step=${data.step} progress=${data.progress}% ${message}`);
      if (data.step === "downloading_model") {
        updateTask(taskId, { progress: Math.min(Math.floor(data.progress * 0.25), 25), current_step: message });
      } else {
        const pct = Math.min(Math.floor(data.progress * 0.3), 30);
        updateTask(taskId, { progress: pct, current_step: message });
      }
    }, log);

    // After transcription, push initial speech/silence segments
    taskLog(taskId, `Transcription complete! Reading transcript...`);
    const rawTranscript = JSON.parse(await fs.readFile(transcriptPath, "utf-8"));
    taskLog(taskId, `Transcript: ${rawTranscript.segments?.length} segments, duration=${rawTranscript.duration}s, language=${rawTranscript.language}`);
    const tSegments = rawTranscript.segments as Array<{ start: number; end: number; text: string }>;
    const initialSegments: TimelineSegment[] = [];
    for (let i = 0; i < tSegments.length; i++) {
      if (i === 0 && tSegments[0].start > 0.5) {
        initialSegments.push({ start: 0, end: tSegments[0].start, type: "silence" });
      }
      initialSegments.push({ start: tSegments[i].start, end: tSegments[i].end, type: "speech" });
      if (i < tSegments.length - 1) {
        const gap = tSegments[i + 1].start - tSegments[i].end;
        if (gap > 0.5) {
          initialSegments.push({ start: tSegments[i].end, end: tSegments[i + 1].start, type: "silence" });
        }
      }
    }
    if (tSegments.length > 0) {
      const lastEnd = tSegments[tSegments.length - 1].end;
      if (rawTranscript.duration - lastEnd > 0.5) {
        initialSegments.push({ start: lastEnd, end: rawTranscript.duration, type: "silence" });
      }
    }
    taskLog(taskId, `Pushed ${initialSegments.length} initial segments to timeline`);
    notifySegments(taskId, initialSegments);

    // === Step 2: Feature A — Clean ===
    if (task.mode === "clean" || task.mode === "both") {
      const hasApiKey = hasAIKey();
      taskLog(taskId, `Step 2: Analysis (hasApiKey=${hasApiKey})`);

      let analysis: AnalysisResult;
      if (hasApiKey) {
        taskLog(taskId, `Using AI analysis...`);
        updateTask(taskId, { status: "analyzing", progress: 35, current_step: "Analyzing content with AI..." });
        analysis = await analyzeTranscript(
          transcriptPath,
          config.silence_threshold,
          config.keep_fillers
        );
      } else {
        taskLog(taskId, `Using FFmpeg silencedetect (no API key)`);
        updateTask(taskId, { status: "analyzing", progress: 35, current_step: "检测静音段落..." });
        analysis = await analyzeTranscriptBasic(
          transcriptPath,
          config.silence_threshold,
          videoPath
        );
      }

      taskLog(taskId, `Analysis complete: ${analysis.segments.length} segments`);
      const silenceCount = analysis.segments.filter(s => s.type === "silence").length;
      const fillerCount = analysis.segments.filter(s => s.type === "filler").length;
      const keepCount = analysis.segments.filter(s => s.type === "keep").length;
      taskLog(taskId, `Breakdown: keep=${keepCount}, silence=${silenceCount}, filler=${fillerCount}`);

      // Push classified segments after analysis
      const classifiedSegments: TimelineSegment[] = analysis.segments.map((s) => ({
        start: s.start,
        end: s.end,
        type: s.type,
        reason: s.reason || (s.type === "silence" ? `静音 ${(s.end - s.start).toFixed(1)}s` : undefined),
      }));
      notifySegments(taskId, classifiedSegments);
      taskLog(taskId, `Pushed classified segments to timeline`);

      taskLog(taskId, `Generating subtitles...`);
      updateTask(taskId, { progress: 50, current_step: "Generating subtitles..." });
      const srtPath = await generateSRT(analysis.segments, path.join(OUTPUTS_DIR, `${taskId}.srt`));
      result.srt_file = srtPath;

      // Also generate animated ASS subtitle
      const assPath = await generateAnimatedASS(transcriptPath, path.join(OUTPUTS_DIR, `${taskId}.ass`), config.subtitle_style);
      result.subtitle_file = assPath; // Prefer ASS over SRT

      taskLog(taskId, `Subtitles generated: SRT=${srtPath}, ASS=${assPath}`);
      taskLog(taskId, `Cleaning video with FFmpeg...`);
      updateTask(taskId, { status: "processing", progress: 55, current_step: "Cleaning video..." });
      const cleanedPath = await cleanVideo(
        videoPath,
        analysis.segments,
        taskId,
        config.burn_subtitles,
        srtPath
      );
      result.cleaned_video = cleanedPath;
      taskLog(taskId, `Video cleaned: ${cleanedPath}`);
    }

    // === Step 3: Feature B — Highlights (requires API key) ===
    const hasApiKeyForHighlights = hasAIKey();
    taskLog(taskId, `Step 3: Highlights (mode=${task.mode}, hasApiKey=${hasApiKeyForHighlights})`);
    if ((task.mode === "highlights" || task.mode === "both") && hasApiKeyForHighlights) {
      taskLog(taskId, `Extracting highlights...`);
      updateTask(taskId, { progress: 70, current_step: "Extracting highlights..." });

      const highlights = await extractHighlights(transcriptPath);
      taskLog(taskId, `Found ${highlights.clips.length} highlight clips`);

      const timelineClips: TimelineClip[] = highlights.clips.map((c) => ({
        start: c.start,
        end: c.end,
        title: c.title,
        score: c.score,
      }));
      notifyClips(taskId, timelineClips);

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
    taskLog(taskId, `========== PROCESSING COMPLETE ==========`);
    taskLog(taskId, `Result: ${JSON.stringify(Object.keys(result))}`);
    updateTask(taskId, {
      status: "completed",
      progress: 100,
      current_step: "Done!",
      result: JSON.stringify(result),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    taskLog(taskId, "========== FAILED ==========", "error");
    taskLog(taskId, `Error: ${message}`, "error");
    updateTask(taskId, { status: "failed", error: message, current_step: "Failed" });
    throw err;
  }
}
