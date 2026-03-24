import { spawn } from "child_process";
import path from "path";
import { OUTPUTS_DIR } from "@/lib/constants";
import { TaskConfig } from "@/lib/schema";
import { Segment } from "./analyze";
import { Clip } from "./extract";
import fs from "fs/promises";

const QUALITY_PRESETS = {
  high:   { bitrate: null,  maxHeight: 0 },     // null = use -q:v quality mode, 0 = no downscale
  medium: { bitrate: "4M",  maxHeight: 1080 },
  low:    { bitrate: "2M",  maxHeight: 720 },
} as const;

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

// ---------------------------------------------------------------------------
// Enhancement filter builder
// ---------------------------------------------------------------------------

interface EnhancementFilters {
  audioFilters: string[];
  videoFilters: string[];
}

function buildEnhancementFilters(config: TaskConfig): EnhancementFilters {
  const audioFilters: string[] = [];
  const videoFilters: string[] = [];

  // Denoise (applied first — values calibrated to avoid artifacts)
  if (config.denoise !== "off") {
    const nfMap = { light: -20, medium: -30, strong: -40 } as const;
    audioFilters.push(`afftdn=nf=${nfMap[config.denoise]}`);
  }

  // Normalize (after denoise) — single-pass loudnorm, acceptable quality
  if (config.normalize_audio) {
    audioFilters.push("loudnorm=I=-16:TP=-1.5:LRA=11");
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
  const { audioFilters, videoFilters } = config
    ? buildEnhancementFilters(config)
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

  // 2. Quality downscale (if needed)
  const preset = QUALITY_PRESETS[config?.output_quality ?? "high"];
  if (preset.maxHeight > 0) {
    videoFilters.unshift(`scale=-2:'min(ih,${preset.maxHeight})'`);
  }

  // 3. Video enhancement filters + fade
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

  const videoEncArgs = preset.bitrate
    ? ["-c:v", "h264_videotoolbox", "-b:v", preset.bitrate]
    : ["-c:v", "h264_videotoolbox", "-q:v", "65"];

  await runFFmpeg([
    "-i", inputPath,
    "-filter_complex", filterComplex,
    "-map", `[${currentVideoLabel}]`,
    "-map", `[${currentAudioLabel}]`,
    ...videoEncArgs,
    "-c:a", "aac", "-b:a", "128k",
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

  const { audioFilters, videoFilters } = config
    ? buildEnhancementFilters(config)
    : { audioFilters: [] as string[], videoFilters: [] as string[] };

  const fadeConfig = config?.fade;
  const speed = config?.speed ?? 1;

  // Compute clip duration after speed adjustment
  const clipDuration = (clip.end - clip.start) / (speed || 1);

  // Build fade filters
  const videoFadeFilters: string[] = [];
  const audioFadeFilters: string[] = [];
  if (fadeConfig?.enabled && fadeConfig.duration > 0) {
    const d = fadeConfig.duration;
    videoFadeFilters.push(`fade=t=in:d=${d},fade=t=out:st=${(clipDuration - d).toFixed(3)}:d=${d}`);
    audioFadeFilters.push(`afade=t=in:d=${d},afade=t=out:st=${(clipDuration - d).toFixed(3)}:d=${d}`);
  }

  // --- First call: re-encode with audio enhancements ---
  const clipPreset = QUALITY_PRESETS[config?.output_quality ?? "high"];
  const clipVideoEncArgs = clipPreset.bitrate
    ? ["-c:v", "h264_videotoolbox", "-b:v", clipPreset.bitrate]
    : ["-c:v", "h264_videotoolbox", "-q:v", "65"];

  const firstCallArgs = [
    "-i", inputPath,
    "-ss", clip.start.toString(),
    "-to", clip.end.toString(),
    ...clipVideoEncArgs,
  ];

  const allAudioFilters = [...audioFilters, ...audioFadeFilters];
  if (allAudioFilters.length > 0) {
    firstCallArgs.push("-af", allAudioFilters.join(","));
  }

  firstCallArgs.push("-c:a", "aac", "-b:a", "128k");
  firstCallArgs.push(outputPath);

  await runFFmpeg(firstCallArgs);

  // --- Second call: vertical crop + video enhancements ---
  const croppedPath = path.join(OUTPUTS_DIR, `${taskId}-clip${clipIndex}-vertical.mp4`);

  const scaleFilters: string[] = [];
  if (clipPreset.maxHeight > 0) {
    scaleFilters.push(`scale=-2:'min(ih,${clipPreset.maxHeight})'`);
  }
  const allVideoFilters = ["crop=ih*9/16:ih", ...scaleFilters, ...videoFilters, ...videoFadeFilters];
  const secondCallArgs = [
    "-i", outputPath,
    "-vf", allVideoFilters.join(","),
  ];

  // If audio filters were applied in step 1, audio is already re-encoded; copy it
  secondCallArgs.push("-c:a", "copy");
  secondCallArgs.push(croppedPath);

  await runFFmpeg(secondCallArgs);

  await fs.unlink(outputPath).catch(() => {});
  await fs.rename(croppedPath, outputPath);

  return outputPath;
}
