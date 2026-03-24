import { NextRequest, NextResponse } from "next/server";
import { reExportTask, getTask } from "@/services/task-manager";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const task = getTask(id);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await _req.json();
  const { segments } = body;

  if (!segments || !Array.isArray(segments)) {
    return NextResponse.json({ error: "segments array required" }, { status: 400 });
  }

  // Fire and forget
  reExportTask(id, segments).catch((err) => {
    console.error(`Re-export ${id} failed:`, err);
  });

  return NextResponse.json({ ok: true });
}
