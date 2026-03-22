import fs from "fs/promises";
import { Segment } from "./analyze";

/**
 * Build a time remapping function from original → cleaned timeline.
 * After silence removal, the cleaned video has a compressed timeline.
 * This maps any original timestamp to its position in the cleaned video.
 */
export function buildTimeRemap(segments: Segment[]): (t: number) => number {
  const keepSegments = segments.filter((s) => s.type === "keep");
  if (!keepSegments.length) return (t) => t;

  // Precompute cumulative offsets for each keep segment
  const entries: Array<{ origStart: number; origEnd: number; newStart: number }> = [];
  let cursor = 0;
  for (const s of keepSegments) {
    entries.push({ origStart: s.start, origEnd: s.end, newStart: cursor });
    cursor += s.end - s.start;
  }

  return (t: number): number => {
    // Before first keep segment → snap to 0
    if (t < entries[0].origStart) return 0;

    for (const e of entries) {
      if (t >= e.origStart && t <= e.origEnd) {
        return e.newStart + (t - e.origStart);
      }
    }
    // In a gap between keep segments → snap to end of preceding keep segment
    for (let i = 0; i < entries.length - 1; i++) {
      if (t > entries[i].origEnd && t < entries[i + 1].origStart) {
        return entries[i].newStart + (entries[i].origEnd - entries[i].origStart);
      }
    }
    // Past the end
    const last = entries[entries.length - 1];
    return last.newStart + (last.origEnd - last.origStart);
  };
}

export async function generateSRT(
  segments: Segment[],
  outputPath: string
): Promise<string> {
  const keepSegments = segments.filter((s) => s.type === "keep" && s.text);
  const remap = buildTimeRemap(segments);
  const lines: string[] = [];

  keepSegments.forEach((seg, i) => {
    lines.push(`${i + 1}`);
    lines.push(`${formatTime(remap(seg.start))} --> ${formatTime(remap(seg.end))}`);
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

/**
 * Generate ASS subtitle with word-by-word highlight animation (TikTok style).
 * Uses whisper word-level timestamps for precise timing.
 */
export async function generateAnimatedASS(
  transcriptPath: string,
  outputPath: string,
  style: "default" | "large-center" = "large-center",
  segments?: Segment[]
): Promise<string> {
  const raw = await fs.readFile(transcriptPath, "utf-8");
  const transcript = JSON.parse(raw);
  const assPath = outputPath.replace(/\.\w+$/, ".ass");

  // Build time remapper if segments provided (for cleaned video subtitles)
  const remap = segments ? buildTimeRemap(segments) : (t: number) => t;

  const fontSize = style === "large-center" ? 24 : 18;
  const marginV = style === "large-center" ? 40 : 20;

  // ASS header
  const header = `[Script Info]
Title: ClipWise Subtitles
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,${fontSize},&H00FFFFFF,&H000078FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,2,0,2,10,10,${marginV},1
Style: Highlight,Arial,${fontSize},&H000078FF,&H000078FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,2,0,2,10,10,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events: string[] = [];

  // Filter to only keep segments that overlap with "keep" regions (if segments provided)
  const keepRanges = segments?.filter((s) => s.type === "keep");

  for (const segment of transcript.segments) {
    // Skip segments that fall entirely within removed regions
    if (keepRanges && !keepRanges.some((k) => segment.end > k.start && segment.start < k.end)) {
      continue;
    }

    if (!segment.words || segment.words.length === 0) {
      const start = formatASSTime(remap(segment.start));
      const end = formatASSTime(remap(segment.end));
      events.push(`Dialogue: 0,${start},${end},Default,,0,0,0,,${escapeASS(segment.text)}`);
      continue;
    }

    // Filter words to only those within keep regions
    const filteredWords = keepRanges
      ? segment.words.filter((w: { start: number; end: number }) =>
          keepRanges.some((k) => w.end > k.start && w.start < k.end))
      : segment.words;

    if (filteredWords.length === 0) continue;

    const lines = groupWordsIntoLines(filteredWords, 15);

    for (const line of lines) {
      const lineStart = remap(line[0].start);
      const lineEnd = remap(line[line.length - 1].end);

      let assText = "";
      for (const word of line) {
        // Duration stays the same (word timing doesn't change, just position shifts)
        const duration = Math.round((word.end - word.start) * 100);
        assText += `{\\kf${duration}}${word.word}`;
      }

      const start = formatASSTime(lineStart);
      const end = formatASSTime(lineEnd + 0.5);
      events.push(`Dialogue: 0,${start},${end},Default,,0,0,0,,${assText}`);
    }
  }

  const content = header + events.join("\n") + "\n";
  await fs.writeFile(assPath, content, "utf-8");
  return assPath;
}

function groupWordsIntoLines(
  words: Array<{ word: string; start: number; end: number }>,
  maxChars: number
): Array<Array<{ word: string; start: number; end: number }>> {
  const lines: Array<Array<{ word: string; start: number; end: number }>> = [];
  let currentLine: Array<{ word: string; start: number; end: number }> = [];
  let currentLength = 0;

  for (const word of words) {
    const wordLen = word.word.trim().length;
    if (currentLength + wordLen > maxChars && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = [];
      currentLength = 0;
    }
    currentLine.push(word);
    currentLength += wordLen;
  }

  if (currentLine.length > 0) lines.push(currentLine);
  return lines;
}

function formatASSTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}

function escapeASS(text: string): string {
  return text.replace(/\n/g, "\\N").replace(/\{/g, "\\{").replace(/\}/g, "\\}");
}
