import { aiChat, extractJSON } from "@/lib/ai";
import { spawn } from "child_process";
import fs from "fs/promises";

export interface Segment {
  start: number;
  end: number;
  type: "keep" | "silence" | "filler";
  text?: string;
  reason?: string;
}

export interface AnalysisResult {
  segments: Segment[];
}

const MAX_RETRIES = 2;

export async function analyzeTranscript(
  transcriptPath: string,
  silenceThreshold: number,
  keepFillers: boolean
): Promise<AnalysisResult> {
  const raw = await fs.readFile(transcriptPath, "utf-8");
  const transcript = JSON.parse(raw);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callAI(transcript, silenceThreshold, keepFillers);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) continue;
    }
  }

  throw lastError;
}

async function callAI(
  transcript: { segments: unknown[]; duration: number },
  silenceThreshold: number,
  keepFillers: boolean
): Promise<AnalysisResult> {
  const prompt = `You are a video editor assistant. Analyze this transcript and classify each segment.

Rules:
- Mark gaps longer than ${silenceThreshold} seconds as "silence"
- Mark filler words, repeated phrases, false starts, and verbal stumbles as "filler"
- Mark everything else as "keep"
${keepFillers ? '- Actually, keep fillers as "keep" since the user wants them preserved' : ""}

Transcript (JSON with segments, each having start/end timestamps and text):
${JSON.stringify(transcript.segments, null, 2)}

Total video duration: ${transcript.duration} seconds

Respond with ONLY valid JSON matching this schema:
{
  "segments": [
    {
      "start": <number>,
      "end": <number>,
      "type": "keep" | "silence" | "filler",
      "text": "<text for keep segments>",
      "reason": "<reason for filler segments>"
    }
  ]
}

Requirements:
- Segments must cover the entire duration from 0 to ${transcript.duration}
- No gaps or overlaps between segments
- end of one segment equals start of next`;

  const response = await aiChat(prompt, 16384);
  const result = extractJSON<AnalysisResult>(response.text);
  validateSegments(result.segments, transcript.duration);
  return result;
}

/**
 * Detect silence using FFmpeg's silencedetect filter (audio waveform analysis).
 * Much more accurate than Whisper timestamp gaps.
 */
function detectSilenceFFmpeg(videoPath: string, silenceThreshold: number): Promise<Array<{ start: number; end: number }>> {
  return new Promise((resolve, reject) => {
    // Convert threshold in seconds to dB noise floor
    // silenceThreshold controls minimum duration, noise floor is fixed at -30dB
    const noisedB = "-30dB";
    const minDuration = Math.max(silenceThreshold, 0.3);

    console.log(`[silencedetect] Running: noise=${noisedB}, min_duration=${minDuration}s`);

    const proc = spawn("ffmpeg", [
      "-i", videoPath,
      "-af", `silencedetect=n=${noisedB}:d=${minDuration}`,
      "-f", "null", "-",
    ], { stdio: ["pipe", "pipe", "pipe"] });

    let stderr = "";
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`silencedetect failed (code ${code})`));
        return;
      }

      const silences: Array<{ start: number; end: number }> = [];
      const lines = stderr.split("\n");

      let currentStart: number | null = null;
      for (const line of lines) {
        const startMatch = line.match(/silence_start:\s*([\d.]+)/);
        if (startMatch) {
          currentStart = parseFloat(startMatch[1]);
        }
        const endMatch = line.match(/silence_end:\s*([\d.]+)/);
        if (endMatch && currentStart !== null) {
          silences.push({ start: currentStart, end: parseFloat(endMatch[1]) });
          currentStart = null;
        }
      }

      console.log(`[silencedetect] Found ${silences.length} silence segments`);
      resolve(silences);
    });
  });
}

/**
 * Basic analysis without API — uses FFmpeg silencedetect on the original video.
 * Combines silence detection with Whisper transcript for text-aware segments.
 */
export async function analyzeTranscriptBasic(
  transcriptPath: string,
  silenceThreshold: number,
  videoPath?: string
): Promise<AnalysisResult> {
  const raw = await fs.readFile(transcriptPath, "utf-8");
  const transcript = JSON.parse(raw);
  const duration = transcript.duration as number;
  const tSegments = transcript.segments as Array<{ start: number; end: number; text: string }>;

  if (!tSegments.length) {
    return { segments: [{ start: 0, end: duration, type: "silence" }] };
  }

  // If we have the video path, use FFmpeg silencedetect for accurate detection
  if (videoPath) {
    const silences = await detectSilenceFFmpeg(videoPath, silenceThreshold);
    const segments: Segment[] = [];

    // Build timeline: everything is "keep" unless overlapping with detected silence
    let cursor = 0;
    for (const silence of silences) {
      if (silence.start > cursor) {
        // Find text for this keep segment from transcript
        const text = tSegments
          .filter((t) => t.start < silence.start && t.end > cursor)
          .map((t) => t.text)
          .join(" ");
        segments.push({ start: cursor, end: silence.start, type: "keep", text });
      }
      segments.push({
        start: silence.start,
        end: silence.end,
        type: "silence",
        reason: `静音 ${(silence.end - silence.start).toFixed(1)}s`,
      });
      cursor = silence.end;
    }

    // Remaining after last silence
    if (cursor < duration) {
      const text = tSegments
        .filter((t) => t.end > cursor)
        .map((t) => t.text)
        .join(" ");
      segments.push({ start: cursor, end: duration, type: "keep", text });
    }

    // If no silence detected at all, keep everything
    if (segments.length === 0) {
      segments.push({ start: 0, end: duration, type: "keep" });
    }

    return { segments };
  }

  // Fallback: use Whisper transcript gaps (less accurate)
  const segments: Segment[] = [];
  if (tSegments[0].start > silenceThreshold) {
    segments.push({ start: 0, end: tSegments[0].start, type: "silence" });
  } else if (tSegments[0].start > 0) {
    segments.push({ start: 0, end: tSegments[0].start, type: "keep", text: "" });
  }

  for (let i = 0; i < tSegments.length; i++) {
    const seg = tSegments[i];
    segments.push({ start: seg.start, end: seg.end, type: "keep", text: seg.text });
    if (i < tSegments.length - 1) {
      const gap = tSegments[i + 1].start - seg.end;
      if (gap > silenceThreshold) {
        segments.push({ start: seg.end, end: tSegments[i + 1].start, type: "silence" });
      } else if (gap > 0.1) {
        segments.push({ start: seg.end, end: tSegments[i + 1].start, type: "keep", text: "" });
      }
    }
  }

  const lastEnd = tSegments[tSegments.length - 1].end;
  if (duration - lastEnd > silenceThreshold) {
    segments.push({ start: lastEnd, end: duration, type: "silence" });
  } else if (duration - lastEnd > 0.1) {
    segments.push({ start: lastEnd, end: duration, type: "keep", text: "" });
  }

  return { segments };
}

function validateSegments(segments: Segment[], duration: number) {
  if (!segments.length) throw new Error("No segments returned");
  for (let i = 0; i < segments.length - 1; i++) {
    if (Math.abs(segments[i].end - segments[i + 1].start) > 0.1) {
      throw new Error(`Gap/overlap between segment ${i} and ${i + 1}`);
    }
  }
  if (segments[segments.length - 1].end > duration + 1) {
    throw new Error("Last segment exceeds video duration");
  }
}
