import { NextRequest, NextResponse } from "next/server";
import { createTask, listTasks } from "@/services/task-manager";
import { TaskConfig, DEFAULT_CONFIG } from "@/lib/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const tasks = listTasks();
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { filename, filepath, mode = "both", config, trim } = body;

  if (!filename || !filepath) {
    return NextResponse.json({ error: "filename and filepath required" }, { status: 400 });
  }

  const taskConfig: TaskConfig = { ...DEFAULT_CONFIG, ...config, ...(trim ? { trim } : {}) };
  const taskId = await createTask(filename, filepath, mode, taskConfig);

  return NextResponse.json({ id: taskId });
}
