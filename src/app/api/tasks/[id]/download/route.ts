import { NextRequest, NextResponse } from "next/server";
import { getTask } from "@/services/task-manager";
import { TaskResult } from "@/lib/schema";
import { OUTPUTS_DIR, TEMP_DIR } from "@/lib/constants";
import fs from "fs/promises";
import path from "path";
import archiver from "archiver";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = getTask(id);
  if (!task || !task.result) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result: TaskResult = JSON.parse(task.result);
  const type = req.nextUrl.searchParams.get("type");

  if (type === "export") {
    const file = req.nextUrl.searchParams.get("file");
    if (!file) return NextResponse.json({ error: "Missing file param" }, { status: 400 });

    // Sanitize: only allow basename, prevent path traversal
    const basename = path.basename(file);
    const filepath = path.join(OUTPUTS_DIR, basename);

    const readExportFile = async (): Promise<Buffer> => {
      try {
        return await fs.readFile(filepath);
      } catch {
        try {
          return await fs.readFile(path.join(TEMP_DIR, basename));
        } catch {
          throw new Error("not_found");
        }
      }
    };

    let exportBuffer: Buffer;
    try {
      exportBuffer = await readExportFile();
    } catch {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const ext = path.extname(basename).toLowerCase();
    const contentTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".mp3": "audio/mpeg",
      ".m4a": "audio/mp4",
      ".mp4": "video/mp4",
    };

    return new NextResponse(exportBuffer.buffer.slice(exportBuffer.byteOffset, exportBuffer.byteOffset + exportBuffer.byteLength) as ArrayBuffer, {
      headers: {
        "Content-Type": contentTypes[ext] || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${basename}"`,
      },
    });
  }

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
