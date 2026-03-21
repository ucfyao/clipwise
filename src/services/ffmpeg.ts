import { spawn } from "child_process";
import path from "path";
import { OUTPUTS_DIR, TEMP_DIR } from "@/lib/constants";
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

export async function cleanVideo(
  inputPath: string,
  segments: Segment[],
  taskId: string,
  burnSubtitles: boolean,
  srtPath?: string
): Promise<string> {
  const keepSegments = segments.filter((s) => s.type === "keep");
  if (!keepSegments.length) throw new Error("No segments to keep");

  // Merge adjacent keep segments to reduce cuts (and avoid keyframe drift)
  const mergedSegments: { start: number; end: number }[] = [];
  for (const seg of keepSegments) {
    const last = mergedSegments[mergedSegments.length - 1];
    if (last && Math.abs(seg.start - last.end) < 0.05) {
      // Adjacent — extend the previous segment
      last.end = seg.end;
    } else {
      mergedSegments.push({ start: seg.start, end: seg.end });
    }
  }

  console.log(`[ffmpeg] ${keepSegments.length} keep segments merged to ${mergedSegments.length} cuts`);

  const concatPath = path.join(TEMP_DIR, `${taskId}-concat.txt`);
  const partPaths: string[] = [];

  for (let i = 0; i < mergedSegments.length; i++) {
    const seg = mergedSegments[i];
    const partPath = path.join(TEMP_DIR, `${taskId}-part${i}.mp4`);
    partPaths.push(partPath);

    // Use re-encode for precise cuts (avoid keyframe drift that adds extra frames)
    await runFFmpeg([
      "-i", inputPath,
      "-ss", seg.start.toString(),
      "-to", seg.end.toString(),
      "-c:v", "libx264", "-preset", "fast", "-crf", "18",
      "-c:a", "aac", "-b:a", "128k",
      "-avoid_negative_ts", "make_zero",
      partPath,
    ]);
  }

  const concatContent = partPaths.map((p) => `file '${p}'`).join("\n");
  await fs.writeFile(concatPath, concatContent, "utf-8");

  const outputPath = path.join(OUTPUTS_DIR, `${taskId}-cleaned.mp4`);
  const concatArgs = ["-f", "concat", "-safe", "0", "-i", concatPath];

  if (burnSubtitles && srtPath) {
    const escapedSrt = srtPath.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "'\\''");
    concatArgs.push("-vf", `subtitles='${escapedSrt}'`, "-c:a", "copy", outputPath);
  } else {
    concatArgs.push("-c", "copy", outputPath);
  }

  await runFFmpeg(concatArgs);

  for (const p of partPaths) await fs.unlink(p).catch(() => {});
  await fs.unlink(concatPath).catch(() => {});

  return outputPath;
}

export async function extractClip(
  inputPath: string,
  clip: Clip,
  taskId: string,
  clipIndex: number
): Promise<string> {
  const outputPath = path.join(OUTPUTS_DIR, `${taskId}-clip${clipIndex}.mp4`);

  await runFFmpeg([
    "-i", inputPath,
    "-ss", clip.start.toString(),
    "-to", clip.end.toString(),
    "-c", "copy",
    "-avoid_negative_ts", "make_zero",
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
