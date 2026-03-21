import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { getTask } from "@/services/task-manager";
import { TaskResult, ExportRequest } from "@/lib/schema";
import { extractThumbnail, generateGIF, extractAudio, compressVideo } from "@/services/ffmpeg-tools";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = getTask(id);
  if (!task || task.status !== "completed") {
    return NextResponse.json({ error: "Task not found or not completed" }, { status: 404 });
  }

  const result: TaskResult = JSON.parse(task.result!);
  const body: ExportRequest = await req.json();

  // Use cleaned video if available, otherwise original
  const videoPath = result.cleaned_video || task.filepath;

  let filepath: string;
  let filename: string;

  switch (body.tool) {
    case "thumbnail": {
      const opts = body.options as { time?: number };
      filepath = await extractThumbnail(videoPath, id, opts.time);
      filename = `${task.filename.replace(/\.\w+$/, "")}-thumbnail.jpg`;
      break;
    }
    case "gif": {
      const opts = body.options as { start: number; duration: number; width?: number };
      filepath = await generateGIF(videoPath, id, opts.start, opts.duration, opts.width);
      filename = `${task.filename.replace(/\.\w+$/, "")}-preview.gif`;
      break;
    }
    case "audio": {
      const opts = body.options as { format: "mp3" | "aac" };
      filepath = await extractAudio(videoPath, id, opts.format);
      const ext = opts.format === "aac" ? "m4a" : "mp3";
      filename = `${task.filename.replace(/\.\w+$/, "")}.${ext}`;
      break;
    }
    case "compress": {
      const opts = body.options as { quality: "high" | "medium" | "low" };
      filepath = await compressVideo(videoPath, id, opts.quality);
      filename = `${task.filename.replace(/\.\w+$/, "")}-compressed.mp4`;
      break;
    }
    default:
      return NextResponse.json({ error: "Unknown tool" }, { status: 400 });
  }

  const downloadUrl = `/api/tasks/${id}/download?type=export&file=${encodeURIComponent(path.basename(filepath))}`;

  return NextResponse.json({ filepath, filename, downloadUrl });
}
