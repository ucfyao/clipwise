"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { TimelineSegment, TimelineClip, Task } from "@/lib/schema";

export interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
}

interface SSEState {
  task: Partial<Task> | null;
  segments: TimelineSegment[];
  clips: TimelineClip[];
  logs: LogEntry[];
}

export function useTaskSSE(taskId: string | null) {
  const [state, setState] = useState<SSEState>({
    task: null,
    segments: [],
    clips: [],
    logs: [],
  });
  const sourceRef = useRef<EventSource | null>(null);
  const retriesRef = useRef(0);

  useEffect(() => {
    if (!taskId) {
      console.log("[SSE] No taskId, skipping connection");
      return;
    }

    let disposed = false;
    console.log(`[SSE] Connecting to /api/tasks/${taskId}/sse`);

    function connect() {
      if (disposed) return;
      console.log(`[SSE] Opening EventSource (retry #${retriesRef.current})`);

      const source = new EventSource(`/api/tasks/${taskId}/sse`);
      sourceRef.current = source;

      source.onopen = () => {
        console.log("[SSE] Connection opened");
      };

      source.onmessage = (event) => {
        retriesRef.current = 0;
        try {
          const data = JSON.parse(event.data);

          if (data.type === "segments") {
            setState((prev) => ({ ...prev, segments: data.data }));
          } else if (data.type === "clips") {
            setState((prev) => ({ ...prev, clips: data.data }));
          } else if (data.type === "log") {
            const entry: LogEntry = {
              timestamp: new Date().toISOString().slice(11, 23),
              level: data.level || "info",
              message: data.message,
            };
            setState((prev) => ({
              ...prev,
              logs: [...prev.logs, entry].slice(-200),
            }));
          } else {
            setState((prev) => ({
              ...prev,
              task: { ...prev.task, ...data },
            }));
          }
        } catch {
          // ignore parse errors
        }
      };

      source.onerror = () => {
        source.close();
        sourceRef.current = null;
        // Auto-reconnect unless task is done/failed or we've retried too many times
        if (!disposed && retriesRef.current < 30) {
          retriesRef.current++;
          const delay = Math.min(1000 * retriesRef.current, 5000);
          setTimeout(connect, delay);
        }
      };
    }

    connect();

    return () => {
      disposed = true;
      sourceRef.current?.close();
      sourceRef.current = null;
    };
  }, [taskId]);

  const reset = useCallback(() => {
    retriesRef.current = 0;
    setState({ task: null, segments: [], clips: [], logs: [] });
  }, []);

  return { ...state, reset };
}
