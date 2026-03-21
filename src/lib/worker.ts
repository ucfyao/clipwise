import { spawn } from "child_process";
import { WORKER_DIR } from "./constants";

export interface WorkerProgress {
  step: string;
  progress: number;
  [key: string]: unknown;
}

export type LogFn = (message: string, level?: "info" | "warn" | "error") => void;

export function runPythonWorker(
  script: string,
  args: string[],
  onProgress: (data: WorkerProgress) => void,
  log?: LogFn
): Promise<void> {
  const _log = log || ((msg: string) => console.log(`[worker] ${msg}`));

  return new Promise((resolve, reject) => {
    _log(`Starting: uv run ${script}`);
    _log(`CWD: ${WORKER_DIR}`);

    const proc = spawn("uv", ["run", script, ...args], {
      cwd: WORKER_DIR,
      stdio: ["pipe", "pipe", "pipe"],
    });

    _log(`Process started, PID=${proc.pid}`);

    let stderr = "";
    let lineBuffer = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      const raw = chunk.toString();
      lineBuffer += raw;
      const lines = lineBuffer.split("\n");
      lineBuffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line) as WorkerProgress;
          onProgress(data);
        } catch {
          _log(`[stdout] ${line}`);
        }
      }
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      const msg = chunk.toString();
      stderr += msg;
      for (const line of msg.split("\n")) {
        if (line.trim()) _log(`[stderr] ${line}`, "warn");
      }
    });

    proc.on("error", (err) => {
      _log(`Failed to start: ${err.message}`, "error");
      reject(err);
    });

    proc.on("close", (code) => {
      _log(`Process exited with code ${code}`);
      if (code === 0) resolve();
      else reject(new Error(`Worker exited with code ${code}: ${stderr.slice(-500)}`));
    });
  });
}
