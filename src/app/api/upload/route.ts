import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { UPLOADS_DIR, MAX_FILE_SIZE } from "@/lib/constants";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 2GB)" }, { status: 400 });
  }

  await mkdir(UPLOADS_DIR, { recursive: true });
  const ext = path.extname(file.name) || ".mp4";
  const filename = `${randomUUID()}${ext}`;
  const filepath = path.join(UPLOADS_DIR, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, buffer);

  return NextResponse.json({
    filename: file.name,
    filepath,
    size: file.size,
  });
}
