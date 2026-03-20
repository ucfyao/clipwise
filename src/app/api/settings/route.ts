import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const SETTINGS_PATH = path.join(process.cwd(), "data", "settings.json");

interface Settings {
  anthropic_api_key: string;
  whisper_model: string;
}

const DEFAULTS: Settings = {
  anthropic_api_key: "",
  whisper_model: "large-v3",
};

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
  // Mask API key for display
  const masked = { ...settings };
  if (masked.anthropic_api_key) {
    masked.anthropic_api_key = masked.anthropic_api_key.slice(0, 10) + "..." + masked.anthropic_api_key.slice(-4);
  }
  return NextResponse.json(masked);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const current = await getSettings();
  const updated = { ...current, ...body };

  await fs.mkdir(path.dirname(SETTINGS_PATH), { recursive: true });
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(updated, null, 2));

  // Also set env var for current process
  if (updated.anthropic_api_key) {
    process.env.ANTHROPIC_API_KEY = updated.anthropic_api_key;
  }

  return NextResponse.json({ ok: true });
}
