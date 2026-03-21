import { spawn } from "child_process";
import path from "path";
import { OUTPUTS_DIR } from "@/lib/constants";
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

/**
 * Remove silence/filler segments using trim/atrim + concat filter_complex.
 * Single FFmpeg command, no temp files, frame-accurate cuts.
 */
export async function cleanVideo(
  inputPath: string,
  segments: Segment[],
  taskId: string,
  burnSubtitles: boolean,
  srtPath?: string
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

  let filterComplex = filterParts.join(";");

  // Optionally burn subtitles on the concatenated output
  if (burnSubtitles && srtPath) {
    const escapedSrt = srtPath.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "'\\''");
    filterComplex += `;[outv]subtitles='${escapedSrt}'[finalv]`;
  }

  const mapVideo = burnSubtitles && srtPath ? "[finalv]" : "[outv]";

  await runFFmpeg([
    "-i", inputPath,
    "-filter_complex", filterComplex,
    "-map", mapVideo,
    "-map", "[outa]",
    "-c:v", "h264_videotoolbox", "-q:v", "65",
    "-c:a", "aac", "-b:a", "128k",
    outputPath,
  ]);

  // Verify output
  const stat = await fs.stat(outputPath);
  console.log(`[ffmpeg] Output: ${outputPath} (${(stat.size / 1024 / 1024).toFixed(1)}MB)`);

  return outputPath;
}

export async function extractClip(
  inputPath: string,
  clip: Clip,
  taskId: string,
  clipIndex: number
): Promise<string> {
  const outputPath = path.join(OUTPUTS_DIR, `${taskId}-clip${clipIndex}.mp4`);

  // Re-encode for precise cut
  await runFFmpeg([
    "-i", inputPath,
    "-ss", clip.start.toString(),
    "-to", clip.end.toString(),
    "-c:v", "h264_videotoolbox", "-q:v", "65",
    "-c:a", "aac", "-b:a", "128k",
    outputPath,
  ]);

  const croppedPath = path.join(OUTPUTS_DIR, `${taskId}-clip${clipIndex}-vertical.mp4`);
  await runFFmpeg([
    "-i", outputPath,
    "-vf", "crop=ih*9/16:ih",
    "-c:a", "copy",
    croppedPath,
  ]);

  await fs.unlink(outputPath).catch(() => {});
  await fs.rename(croppedPath, outputPath);

  return outputPath;
}
