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

/**
 * Generate ASS subtitle with word-by-word highlight animation (TikTok style).
 * Uses whisper word-level timestamps for precise timing.
 */
export async function generateAnimatedASS(
  transcriptPath: string,
  outputPath: string,
  style: "default" | "large-center" = "large-center"
): Promise<string> {
  const raw = await fs.readFile(transcriptPath, "utf-8");
  const transcript = JSON.parse(raw);
  const assPath = outputPath.replace(/\.\w+$/, ".ass");

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

  for (const segment of transcript.segments) {
    if (!segment.words || segment.words.length === 0) {
      // Fallback: show full segment text without word-level animation
      const start = formatASSTime(segment.start);
      const end = formatASSTime(segment.end);
      events.push(`Dialogue: 0,${start},${end},Default,,0,0,0,,${escapeASS(segment.text)}`);
      continue;
    }

    // Group words into lines of ~15 chars for readability
    const lines = groupWordsIntoLines(segment.words, 15);

    for (const line of lines) {
      const lineStart = line[0].start;
      const lineEnd = line[line.length - 1].end;

      // Build the line with word-by-word highlight using ASS override tags
      // Each word gets a karaoke timing tag {\kf<duration>} for highlight sweep
      let assText = "";
      for (const word of line) {
        const duration = Math.round((word.end - word.start) * 100); // centiseconds
        assText += `{\\kf${duration}}${word.word}`;
      }

      const start = formatASSTime(lineStart);
      const end = formatASSTime(lineEnd + 0.5); // slight padding
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
