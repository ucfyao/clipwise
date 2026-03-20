import { NextRequest, NextResponse } from "next/server";
import { retryTask, getTask } from "@/services/task-manager";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = getTask(id);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (task.status !== "failed") return NextResponse.json({ error: "Task is not failed" }, { status: 400 });

  await retryTask(id);
  return NextResponse.json({ ok: true });
}
