import { spawn } from "child_process";
import path from "path";
import { OUTPUTS_DIR } from "@/lib/constants";
import { Segment } from "./analyze";
import { Clip } from "./extract";
import fs from "fs/promises";

function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
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
 * Remove silence/filler segments using select/aselect filter approach (Remsi method).
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

  // Build between() expressions for all keep segments
  const betweenExprs = keepSegments
    .map((s) => `between(t,${s.start.toFixed(3)},${s.end.toFixed(3)})`)
    .join("+");

  console.log(`[ffmpeg] Using select/aselect filter with ${keepSegments.length} keep segments`);

  const outputPath = path.join(OUTPUTS_DIR, `${taskId}-cleaned.mp4`);

  // Video filter: select keep segments + reset timestamps
  let vf = `select='${betweenExprs}',setpts=N/FRAME_RATE/TB`;

  // Optionally burn subtitles
  if (burnSubtitles && srtPath) {
    const escapedSrt = srtPath.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "'\\''");
    vf += `,subtitles='${escapedSrt}'`;
  }

  // Audio filter: same selection + reset timestamps
  const af = `aselect='${betweenExprs}',asetpts=N/SR/TB`;

  await runFFmpeg([
    "-i", inputPath,
    "-vf", vf,
    "-af", af,
    "-c:v", "libx264", "-preset", "fast", "-crf", "18",
    "-c:a", "aac", "-b:a", "128k",
    outputPath,
  ]);

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
    "-c:v", "libx264", "-preset", "fast", "-crf", "18",
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
