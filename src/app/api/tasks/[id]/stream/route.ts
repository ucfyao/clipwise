import { NextRequest, NextResponse } from "next/server";
import { getTask } from "@/services/task-manager";
import { TaskResult } from "@/lib/schema";
import fs from "fs/promises";
import { createReadStream } from "fs";

/**
 * Stream video with Range request support for seeking.
 * Used by the video preview player (not for downloads).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = getTask(id);
  if (!task || !task.result) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result: TaskResult = JSON.parse(task.result);
  if (!result.cleaned_video) return NextResponse.json({ error: "No cleaned video" }, { status: 404 });

  const filepath = result.cleaned_video;
  const stat = await fs.stat(filepath);
  const fileSize = stat.size;

  const range = req.headers.get("range");

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    const stream = createReadStream(filepath, { start, end });
    const readable = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk) => controller.enqueue(new Uint8Array(chunk as Buffer)));
        stream.on("end", () => controller.close());
        stream.on("error", (err) => controller.error(err));
      },
    });

    return new NextResponse(readable, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type": "video/mp4",
      },
    });
  }

  // No range — return full file with Accept-Ranges header
  const buffer = await fs.readFile(filepath);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Length": String(fileSize),
      "Accept-Ranges": "bytes",
      "Content-Type": "video/mp4",
    },
  });
}
