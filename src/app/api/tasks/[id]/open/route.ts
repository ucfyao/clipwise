import { NextRequest } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { OUTPUTS_DIR } from "@/lib/constants";

const execFileAsync = promisify(execFile);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await execFileAsync("open", [OUTPUTS_DIR]);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Failed to open directory" }, { status: 500 });
  }
}
