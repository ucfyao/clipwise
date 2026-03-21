"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { TimelineSegment, TimelineClip, Task } from "@/lib/schema";

interface SSEState {
  task: Partial<Task> | null;
  segments: TimelineSegment[];
  clips: TimelineClip[];
}

export function useTaskSSE(taskId: string | null) {
  const [state, setState] = useState<SSEState>({
    task: null,
    segments: [],
    clips: [],
  });
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!taskId) return;

    const source = new EventSource(`/api/tasks/${taskId}/sse`);
    sourceRef.current = source;

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "segments") {
          setState((prev) => ({ ...prev, segments: data.data }));
        } else if (data.type === "clips") {
          setState((prev) => ({ ...prev, clips: data.data }));
        } else {
          // progress or full task update
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
    };

    return () => {
      source.close();
      sourceRef.current = null;
    };
  }, [taskId]);

  const reset = useCallback(() => {
    setState({ task: null, segments: [], clips: [] });
  }, []);

  return { ...state, reset };
}
