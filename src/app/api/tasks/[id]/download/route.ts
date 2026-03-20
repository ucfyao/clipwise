import { NextRequest, NextResponse } from "next/server";
import { getTask } from "@/services/task-manager";
import { TaskResult } from "@/lib/schema";
import fs from "fs/promises";
import path from "path";
import archiver from "archiver";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = getTask(id);
  if (!task || !task.result) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result: TaskResult = JSON.parse(task.result);
  const type = req.nextUrl.searchParams.get("type");

  if (type === "cleaned" && result.cleaned_video) {
    const buffer = await fs.readFile(result.cleaned_video);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${task.filename.replace(/\.\w+$/, "")}-cleaned.mp4"`,
      },
    });
  }

  // For clips or all, return zip
  const archive = archiver("zip", { zlib: { level: 5 } });
  const chunks: Buffer[] = [];

  archive.on("data", (chunk) => chunks.push(chunk));

  if (result.cleaned_video && (type === "all" || !type)) {
    archive.file(result.cleaned_video, { name: path.basename(result.cleaned_video) });
  }
  if (result.subtitle_file && (type === "all" || !type)) {
    archive.file(result.subtitle_file, { name: path.basename(result.subtitle_file) });
  }
  if (result.clips) {
    for (const clip of result.clips) {
      archive.file(clip.filepath, { name: `clips/${clip.title}.mp4` });
      if (clip.subtitle_file) {
        archive.file(clip.subtitle_file, { name: `clips/${clip.title}.srt` });
      }
    }
  }

  await archive.finalize();
  await new Promise<void>((resolve) => archive.on("end", resolve));

  const buffer = Buffer.concat(chunks);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${task.filename.replace(/\.\w+$/, "")}-clipwise.zip"`,
    },
  });
}
