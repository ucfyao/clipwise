import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";
import { OUTPUTS_DIR, TEMP_DIR } from "@/lib/constants";

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

export async function extractThumbnail(
  videoPath: string,
  taskId: string,
  time?: number
): Promise<string> {
  const outputPath = path.join(OUTPUTS_DIR, `${taskId}-thumbnail.jpg`);

  if (time !== undefined) {
    await runFFmpeg([
      "-ss", String(time),
      "-i", videoPath,
      "-frames:v", "1",
      "-q:v", "2",
      outputPath,
    ]);
  } else {
    await runFFmpeg([
      "-i", videoPath,
      "-vf", "thumbnail=300",
      "-frames:v", "1",
      "-q:v", "2",
      outputPath,
    ]);
  }

  return outputPath;
}

export async function generateGIF(
  videoPath: string,
  taskId: string,
  start: number,
  duration: number,
  width: number = 320
): Promise<string> {
  const palettePath = path.join(TEMP_DIR, `${taskId}-palette.png`);
  const outputPath = path.join(OUTPUTS_DIR, `${taskId}-preview.gif`);

  // Pass 1: generate palette
  await runFFmpeg([
    "-ss", String(start),
    "-t", String(duration),
    "-i", videoPath,
    "-vf", `fps=10,scale=${width}:-1:flags=lanczos,palettegen`,
    palettePath,
  ]);

  // Pass 2: use palette to generate GIF
  await runFFmpeg([
    "-ss", String(start),
    "-t", String(duration),
    "-i", videoPath,
    "-i", palettePath,
    "-filter_complex", `[0:v]fps=10,scale=${width}:-1:flags=lanczos[v];[v][1:v]paletteuse=dither=bayer`,
    outputPath,
  ]);

  // Clean up palette file
  await fs.unlink(palettePath).catch(() => {});

  return outputPath;
}

export async function extractAudio(
  videoPath: string,
  taskId: string,
  format: "mp3" | "aac" = "mp3"
): Promise<string> {
  if (format === "mp3") {
    const outputPath = path.join(OUTPUTS_DIR, `${taskId}-audio.mp3`);
    await runFFmpeg([
      "-i", videoPath,
      "-vn",
      "-acodec", "libmp3lame",
      "-q:a", "2",
      outputPath,
    ]);
    return outputPath;
  } else {
    const outputPath = path.join(OUTPUTS_DIR, `${taskId}-audio.m4a`);
    await runFFmpeg([
      "-i", videoPath,
      "-vn",
      "-acodec", "aac",
      "-b:a", "192k",
      outputPath,
    ]);
    return outputPath;
  }
}

export async function compressVideo(
  videoPath: string,
  taskId: string,
  quality: "high" | "medium" | "low" = "medium"
): Promise<string> {
  const outputPath = path.join(OUTPUTS_DIR, `${taskId}-compressed.mp4`);

  const crfMap: Record<"high" | "medium" | "low", number> = {
    high: 23,
    medium: 28,
    low: 35,
  };
  const crf = crfMap[quality];

  const args: string[] = ["-i", videoPath];

  if (quality === "medium" || quality === "low") {
    args.push("-vf", "scale=-2:720");
  }

  args.push(
    "-c:v", "libx264",
    "-crf", String(crf),
    "-preset", "medium",
    "-c:a", "aac",
    "-b:a", "128k",
    outputPath
  );

  await runFFmpeg(args);

  return outputPath;
}

export async function generateWaveform(
  videoPath: string,
  taskId: string
): Promise<string> {
  const outputPath = path.join(TEMP_DIR, `${taskId}-waveform.png`);

  await runFFmpeg([
    "-i", videoPath,
    "-filter_complex", "showwavespic=s=1200x120:colors=#6366f1",
    "-frames:v", "1",
    outputPath,
  ]);

  return outputPath;
}
