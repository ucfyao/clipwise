/**
 * Unified AI client — supports Gemini (free) and Claude (paid).
 * Reads provider config from env or settings.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";

export type AIProvider = "gemini" | "claude";

interface AIResponse {
  text: string;
}

export function getProvider(): AIProvider {
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== "sk-ant-xxx") return "claude";
  return "gemini"; // default to gemini
}

export function hasAIKey(): boolean {
  return !!(process.env.GEMINI_API_KEY || (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== "sk-ant-xxx"));
}

export async function aiChat(prompt: string, maxTokens = 8192): Promise<AIResponse> {
  const provider = getProvider();

  if (provider === "gemini") {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    });
    return { text: result.response.text() };
  }

  // Claude
  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  if (response.stop_reason !== "end_turn") {
    throw new Error("AI response was truncated");
  }
  return { text };
}

/** Extract JSON from AI response text */
export function extractJSON<T>(text: string): T {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI did not return valid JSON");
  return JSON.parse(match[0]);
}
