import { spawn } from "child_process";
import { WORKER_DIR } from "./constants";

export interface WorkerProgress {
  step: string;
  progress: number;
  [key: string]: unknown;
}

export function runPythonWorker(
  script: string,
  args: string[],
  onProgress: (data: WorkerProgress) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("uv", ["run", script, ...args], {
      cwd: WORKER_DIR,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stderr = "";
    let lineBuffer = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      lineBuffer += chunk.toString();
      const lines = lineBuffer.split("\n");
      lineBuffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line) as WorkerProgress;
          onProgress(data);
        } catch {
          // non-JSON output, ignore
        }
      }
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Worker exited with code ${code}: ${stderr}`));
    });
  });
}
