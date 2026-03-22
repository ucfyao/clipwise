import { spawn } from "child_process";
import path from "path";
import { OUTPUTS_DIR } from "@/lib/constants";
import { TaskConfig } from "@/lib/schema";
import { Segment } from "./analyze";
import { Clip } from "./extract";
import fs from "fs/promises";

function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`[ffmpeg] Running: ffmpeg ${args.join(" ").slice(0, 200)}...`);
    const proc = spawn("ffmpeg", ["-y", ...args], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stderr = "";
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg failed (code ${code}): ${stderr.slice(-500)}`));
    });
  });
}

/** Run FFmpeg and return stderr (for parsing loudnorm stats, etc.) */
function runFFmpegCapture(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(`[ffmpeg] Measuring: ffmpeg ${args.join(" ").slice(0, 200)}...`);
    const proc = spawn("ffmpeg", ["-y", ...args], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stderr = "";
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on("close", (code) => {
      if (code === 0) resolve(stderr);
      else reject(new Error(`FFmpeg failed (code ${code}): ${stderr.slice(-500)}`));
    });
  });
}

// ---------------------------------------------------------------------------
// Loudnorm dual-pass: measure first, then apply with measured values
// ---------------------------------------------------------------------------

interface LoudnormStats {
  input_i: string;
  input_tp: string;
  input_lra: string;
  input_thresh: string;
  target_offset: string;
}

/**
 * Measure audio loudness using loudnorm in print_format=json mode.
 * Returns stats needed for the second (linear) pass.
 */
async function measureLoudnorm(
  inputPath: string,
  seekStart?: number,
  duration?: number,
): Promise<LoudnormStats | null> {
  try {
    const args: string[] = [];
    if (seekStart !== undefined) args.push("-ss", seekStart.toString());
    args.push("-i", inputPath);
    if (duration !== undefined) args.push("-t", duration.toString());
    args.push("-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-");

    const stderr = await runFFmpegCapture(args);

    // Extract JSON block from stderr
    const jsonMatch = stderr.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
    if (!jsonMatch) return null;

    const stats = JSON.parse(jsonMatch[0]);
    return {
      input_i: stats.input_i,
      input_tp: stats.input_tp,
      input_lra: stats.input_lra,
      input_thresh: stats.input_thresh,
      target_offset: stats.target_offset,
    };
  } catch {
    console.log("[ffmpeg] Loudnorm measurement failed, falling back to single-pass");
    return null;
  }
}

// ---------------------------------------------------------------------------
// Enhancement filter builder
// ---------------------------------------------------------------------------

interface EnhancementFilters {
  audioFilters: string[];
  videoFilters: string[];
}

function buildEnhancementFilters(
  config: TaskConfig,
  loudnormStats?: LoudnormStats | null,
): EnhancementFilters {
  const audioFilters: string[] = [];
  const videoFilters: string[] = [];

  // Denoise (applied first) — afftdn with recalibrated per-intensity noise floors
  if (config.denoise !== "off") {
    const nfMap = { light: -15, medium: -25, strong: -35 } as const;
    audioFilters.push(`afftdn=nf=${nfMap[config.denoise]}`);
  }

  // Normalize (after denoise) — dual-pass loudnorm if stats available
  if (config.normalize_audio) {
    if (loudnormStats) {
      audioFilters.push(
        `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${loudnormStats.input_i}:measured_TP=${loudnormStats.input_tp}:measured_LRA=${loudnormStats.input_lra}:measured_thresh=${loudnormStats.input_thresh}:offset=${loudnormStats.target_offset}:linear=true`
      );
    } else {
      audioFilters.push("loudnorm=I=-16:TP=-1.5:LRA=11");
    }
  }

  // Speed
  if (config.speed !== 1) {
    videoFilters.push(`setpts=PTS/${config.speed}`);
    audioFilters.push(`atempo=${config.speed}`);
  }

  return { audioFilters, videoFilters };
}

// ---------------------------------------------------------------------------
// cleanVideo — trim/concat + optional enhancements
// ---------------------------------------------------------------------------

/**
 * Remove silence/filler segments using trim/atrim + concat filter_complex.
 * Single FFmpeg command, no temp files, frame-accurate cuts.
 */
export async function cleanVideo(
  inputPath: string,
  segments: Segment[],
  taskId: string,
  burnSubtitles: boolean,
  srtPath?: string,
  config?: TaskConfig
): Promise<string> {
  const keepSegments = segments.filter((s) => s.type === "keep");
  if (!keepSegments.length) throw new Error("No segments to keep");

  console.log(`[ffmpeg] Building filter_complex with ${keepSegments.length} keep segments`);

  const outputPath = path.join(OUTPUTS_DIR, `${taskId}-cleaned.mp4`);

  // Build trim/atrim + concat filter_complex
  const filterParts: string[] = [];
  const concatInputs: string[] = [];

  for (let i = 0; i < keepSegments.length; i++) {
    const s = keepSegments[i];
    filterParts.push(
      `[0:v]trim=start=${s.start.toFixed(3)}:end=${s.end.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`
    );
    filterParts.push(
      `[0:a]atrim=start=${s.start.toFixed(3)}:end=${s.end.toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`
    );
    concatInputs.push(`[v${i}][a${i}]`);
  }

  filterParts.push(
    `${concatInputs.join("")}concat=n=${keepSegments.length}:v=1:a=1[outv][outa]`
  );

  // --- Enhancement filters ---
  // Run loudnorm measurement pass if normalization is enabled
  let loudnormStats: LoudnormStats | null = null;
  if (config?.normalize_audio) {
    loudnormStats = await measureLoudnorm(inputPath);
  }

  const { audioFilters, videoFilters } = config
    ? buildEnhancementFilters(config, loudnormStats)
    : { audioFilters: [] as string[], videoFilters: [] as string[] };

  const fadeConfig = config?.fade;
  const speed = config?.speed ?? 1;

  // Compute total duration for fade (after speed adjustment)
  const totalDuration =
    keepSegments.reduce((sum, s) => sum + (s.end - s.start), 0) / (speed || 1);

  // Build fade filters (applied last)
  const videoFadeFilters: string[] = [];
  const audioFadeFilters: string[] = [];
  if (fadeConfig?.enabled && fadeConfig.duration > 0) {
    const d = fadeConfig.duration;
    videoFadeFilters.push(`fade=t=in:d=${d},fade=t=out:st=${(totalDuration - d).toFixed(3)}:d=${d}`);
    audioFadeFilters.push(`afade=t=in:d=${d},afade=t=out:st=${(totalDuration - d).toFixed(3)}:d=${d}`);
  }

  // --- Video chain ---
  // Start label after concat is [outv]
  let currentVideoLabel = "outv";

  // 1. Subtitles (if enabled)
  if (burnSubtitles && srtPath) {
    const escapedSrt = srtPath.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "'\\''");
    const nextLabel = "subv";
    filterParts.push(`[${currentVideoLabel}]subtitles='${escapedSrt}'[${nextLabel}]`);
    currentVideoLabel = nextLabel;
  }

  // 2. Video enhancement filters + fade
  const allVideoFilters = [...videoFilters, ...videoFadeFilters];
  if (allVideoFilters.length > 0) {
    const nextLabel = "enhv";
    filterParts.push(
      `[${currentVideoLabel}]${allVideoFilters.join(",")}[${nextLabel}]`
    );
    currentVideoLabel = nextLabel;
  }

  // --- Audio chain ---
  let currentAudioLabel = "outa";
  const allAudioFilters = [...audioFilters, ...audioFadeFilters];
  if (allAudioFilters.length > 0) {
    const nextLabel = "enha";
    filterParts.push(
      `[${currentAudioLabel}]${allAudioFilters.join(",")}[${nextLabel}]`
    );
    currentAudioLabel = nextLabel;
  }

  const filterComplex = filterParts.join(";");

  await runFFmpeg([
    "-hwaccel", "videotoolbox",
    "-i", inputPath,
    "-filter_complex", filterComplex,
    "-map", `[${currentVideoLabel}]`,
    "-map", `[${currentAudioLabel}]`,
    "-c:v", "h264_videotoolbox", "-b:v", "8M",
    "-c:a", "aac", "-b:a", "128k",
    "-max_muxing_queue_size", "1024",
    outputPath,
  ]);

  // Verify output
  const stat = await fs.stat(outputPath);
  console.log(`[ffmpeg] Output: ${outputPath} (${(stat.size / 1024 / 1024).toFixed(1)}MB)`);

  return outputPath;
}

// ---------------------------------------------------------------------------
// extractClip — precise cut + vertical crop + optional enhancements
// ---------------------------------------------------------------------------

export async function extractClip(
  inputPath: string,
  clip: Clip,
  taskId: string,
  clipIndex: number,
  config?: TaskConfig
): Promise<string> {
  const outputPath = path.join(OUTPUTS_DIR, `${taskId}-clip${clipIndex}.mp4`);

  // Loudnorm measurement scoped to this clip's audio range
  let loudnormStats: LoudnormStats | null = null;
  if (config?.normalize_audio) {
    loudnormStats = await measureLoudnorm(inputPath, clip.start, clip.end - clip.start);
  }

  const { audioFilters, videoFilters } = config
    ? buildEnhancementFilters(config, loudnormStats)
    : { audioFilters: [] as string[], videoFilters: [] as string[] };

  const fadeConfig = config?.fade;
  const speed = config?.speed ?? 1;
  const clipDuration = (clip.end - clip.start) / (speed || 1);

  const videoFadeFilters: string[] = [];
  const audioFadeFilters: string[] = [];
  if (fadeConfig?.enabled && fadeConfig.duration > 0) {
    const d = fadeConfig.duration;
    videoFadeFilters.push(`fade=t=in:d=${d},fade=t=out:st=${(clipDuration - d).toFixed(3)}:d=${d}`);
    audioFadeFilters.push(`afade=t=in:d=${d},afade=t=out:st=${(clipDuration - d).toFixed(3)}:d=${d}`);
  }

  // Single-pass: crop + video enhancements + audio enhancements in one filter_complex
  // -ss before -i for fast input seeking, -t for duration (since timestamps reset to 0)
  const allVideoFilters = ["crop=ih*9/16:ih", ...videoFilters, ...videoFadeFilters];
  const allAudioFilters = [...audioFilters, ...audioFadeFilters];

  const args = [
    "-hwaccel", "videotoolbox",
    "-ss", clip.start.toString(),
    "-i", inputPath,
    "-t", (clip.end - clip.start).toString(),
  ];

  if (allVideoFilters.length > 0 || allAudioFilters.length > 0) {
    const filterParts: string[] = [];
    if (allVideoFilters.length > 0) {
      filterParts.push(`[0:v]${allVideoFilters.join(",")}[outv]`);
    }
    if (allAudioFilters.length > 0) {
      filterParts.push(`[0:a]${allAudioFilters.join(",")}[outa]`);
    }
    args.push("-filter_complex", filterParts.join(";"));
    args.push("-map", allVideoFilters.length > 0 ? "[outv]" : "0:v");
    args.push("-map", allAudioFilters.length > 0 ? "[outa]" : "0:a");
  }

  args.push(
    "-c:v", "h264_videotoolbox", "-b:v", "8M",
    "-c:a", "aac", "-b:a", "128k",
    "-max_muxing_queue_size", "1024",
    outputPath
  );

  await runFFmpeg(args);
  return outputPath;
}
