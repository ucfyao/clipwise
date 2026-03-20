import path from "path";
import { TRANSCRIPTS_DIR } from "@/lib/constants";
import { runPythonWorker, WorkerProgress } from "@/lib/worker";

export async function transcribeVideo(
  videoPath: string,
  taskId: string,
  onProgress: (data: WorkerProgress) => void
): Promise<string> {
  const outputPath = path.join(TRANSCRIPTS_DIR, `${taskId}.json`);
  await runPythonWorker("transcribe.py", [videoPath, outputPath], onProgress);
  return outputPath;
}
