import { NextRequest, NextResponse } from "next/server";
import { generateWaveform } from "@/services/ffmpeg-tools";
import fs from "fs/promises";

export async function POST(req: NextRequest) {
  const { filepath } = await req.json();
  if (!filepath) {
    return NextResponse.json({ error: "Missing filepath" }, { status: 400 });
  }

  try {
    // Generate a simple taskId from filepath hash for caching
    const taskId = "wf-" + Buffer.from(filepath).toString("base64url").slice(0, 12);
    const waveformPath = await generateWaveform(filepath, taskId);

    // Read and return as base64 data URL
    const buffer = await fs.readFile(waveformPath);
    const base64 = buffer.toString("base64");
    const dataUrl = `data:image/png;base64,${base64}`;

    return NextResponse.json({ dataUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
