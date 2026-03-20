import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const SETTINGS_PATH = path.join(process.cwd(), "data", "settings.json");

interface Settings {
  ai_provider: "gemini" | "claude";
  gemini_api_key: string;
  anthropic_api_key: string;
  whisper_model: string;
}

const DEFAULTS: Settings = {
  ai_provider: "gemini",
  gemini_api_key: "",
  anthropic_api_key: "",
  whisper_model: "large-v3",
};

function maskKey(key: string): string {
  if (!key) return "";
  return key.slice(0, 8) + "..." + key.slice(-4);
}

async function getSettings(): Promise<Settings> {
  try {
    const raw = await fs.readFile(SETTINGS_PATH, "utf-8");
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json({
    ai_provider: settings.ai_provider,
    gemini_api_key: maskKey(settings.gemini_api_key),
    anthropic_api_key: maskKey(settings.anthropic_api_key),
    whisper_model: settings.whisper_model,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const current = await getSettings();
  const updated = { ...current, ...body };

  await fs.mkdir(path.dirname(SETTINGS_PATH), { recursive: true });
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(updated, null, 2));

  // Set env vars for current process
  if (updated.gemini_api_key) {
    process.env.GEMINI_API_KEY = updated.gemini_api_key;
  }
  if (updated.anthropic_api_key) {
    process.env.ANTHROPIC_API_KEY = updated.anthropic_api_key;
  }

  return NextResponse.json({ ok: true });
}
