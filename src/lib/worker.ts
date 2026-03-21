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
    console.log(`[worker] Starting: uv run ${script} ${args.join(" ")}`);
    console.log(`[worker] CWD: ${WORKER_DIR}`);

    const proc = spawn("uv", ["run", script, ...args], {
      cwd: WORKER_DIR,
      stdio: ["pipe", "pipe", "pipe"],
    });

    console.log(`[worker] PID: ${proc.pid}`);

    let stderr = "";
    let lineBuffer = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      const raw = chunk.toString();
      console.log(`[worker:stdout] ${raw.trimEnd()}`);
      lineBuffer += raw;
      const lines = lineBuffer.split("\n");
      lineBuffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line) as WorkerProgress;
          onProgress(data);
        } catch {
          console.log(`[worker:stdout:raw] ${line}`);
        }
      }
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      const msg = chunk.toString();
      stderr += msg;
      // Print stderr in real-time instead of swallowing it
      for (const line of msg.split("\n")) {
        if (line.trim()) console.log(`[worker:stderr] ${line}`);
      }
    });

    proc.on("error", (err) => {
      console.error(`[worker] Failed to start: ${err.message}`);
      reject(err);
    });

    proc.on("close", (code) => {
      console.log(`[worker] Exited with code ${code}`);
      if (code === 0) resolve();
      else reject(new Error(`Worker exited with code ${code}: ${stderr.slice(-500)}`));
    });
  });
}
