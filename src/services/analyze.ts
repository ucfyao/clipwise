import { getClaude } from "@/lib/claude";
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
      return await callClaude(transcript, silenceThreshold, keepFillers);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) continue;
    }
  }

  throw lastError;
}

async function callClaude(
  transcript: { segments: unknown[]; duration: number },
  silenceThreshold: number,
  keepFillers: boolean
): Promise<AnalysisResult> {
  const claude = getClaude();
  const response = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 16384,
    messages: [
      {
        role: "user",
        content: `You are a video editor assistant. Analyze this transcript and classify each segment.

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
- end of one segment equals start of next`,
      },
    ],
  });

  if (response.stop_reason !== "end_turn") {
    throw new Error("Claude response was truncated — transcript may be too long");
  }

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude did not return valid JSON");

  const result: AnalysisResult = JSON.parse(jsonMatch[0]);
  validateSegments(result.segments, transcript.duration);
  return result;
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
