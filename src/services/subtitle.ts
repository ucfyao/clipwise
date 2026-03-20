import fs from "fs/promises";
import { Segment } from "./analyze";

export async function generateSRT(
  segments: Segment[],
  outputPath: string
): Promise<string> {
  const keepSegments = segments.filter((s) => s.type === "keep" && s.text);
  const lines: string[] = [];

  keepSegments.forEach((seg, i) => {
    lines.push(`${i + 1}`);
    lines.push(`${formatTime(seg.start)} --> ${formatTime(seg.end)}`);
    lines.push(seg.text!);
    lines.push("");
  });

  const srtPath = outputPath.replace(/\.\w+$/, ".srt");
  await fs.writeFile(srtPath, lines.join("\n"), "utf-8");
  return srtPath;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad3(ms)}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function pad3(n: number): string {
  return n.toString().padStart(3, "0");
}
