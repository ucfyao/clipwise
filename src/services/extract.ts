import { aiChat, extractJSON } from "@/lib/ai";
import fs from "fs/promises";

export interface Clip {
  title: string;
  start: number;
  end: number;
  score: number;
  reason: string;
}

export interface ExtractionResult {
  clips: Clip[];
}

export async function extractHighlights(
  transcriptPath: string
): Promise<ExtractionResult> {
  const raw = await fs.readFile(transcriptPath, "utf-8");
  const transcript = JSON.parse(raw);

  const prompt = `You are a content strategist. Extract the best short-form video clips from this teaching video transcript.

Find segments that are:
- Self-contained (make sense without context)
- Valuable (explain a concept, give a great example, have an insight)
- Engaging (would work as a standalone short video on TikTok/YouTube Shorts)
- 30 seconds to 3 minutes long

Transcript:
${JSON.stringify(transcript.segments, null, 2)}

Total duration: ${transcript.duration} seconds

Respond with ONLY valid JSON:
{
  "clips": [
    {
      "title": "<catchy short title>",
      "start": <start_seconds>,
      "end": <end_seconds>,
      "score": <1-10 attractiveness score>,
      "reason": "<why this clip is valuable>"
    }
  ]
}

Sort by score descending. Return up to 10 clips. Clips should not overlap.`;

  const response = await aiChat(prompt, 4096);
  const result = extractJSON<ExtractionResult>(response.text);
  result.clips = result.clips.filter(
    (c) => c.start >= 0 && c.end > c.start && c.end <= transcript.duration + 1
  );
  return result;
}
