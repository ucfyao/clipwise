"use client";

import { useEffect, useState, useRef } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

interface TaskState {
  id: string;
  status: string;
  progress: number;
  current_step: string;
  error?: string | null;
}

const steps = ["Transcribing", "Analyzing", "Processing", "Done"];

function getStepIndex(status: string): number {
  switch (status) {
    case "transcribing": return 0;
    case "analyzing": return 1;
    case "processing": return 2;
    case "completed": return 3;
    default: return -1;
  }
}

export function ProgressDisplay({ taskId }: { taskId: string }) {
  const [task, setTask] = useState<TaskState | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const [eta, setEta] = useState<string | null>(null);

  useEffect(() => {
    startTimeRef.current = Date.now();
    const evtSource = new EventSource(`/api/tasks/${taskId}/sse`);

    evtSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setTask((prev) => ({ ...prev, ...data }));

        // Calculate ETA
        const progress = data.progress ?? 0;
        if (progress > 5) {
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          const totalEstimate = elapsed / (progress / 100);
          const remaining = Math.max(0, totalEstimate - elapsed);
          if (remaining < 60) {
            setEta(`~${Math.ceil(remaining)}s remaining`);
          } else {
            setEta(`~${Math.ceil(remaining / 60)}min remaining`);
          }
        }
      } catch {}
    };

    evtSource.onerror = () => evtSource.close();
    return () => evtSource.close();
  }, [taskId]);

  if (!task) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Connecting...</p>
      </div>
    );
  }

  if (task.status === "failed") {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
        <p className="text-sm font-medium text-destructive">Task Failed</p>
        <p className="mt-2 text-sm text-muted-foreground">{task.error}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={async () => {
            await fetch(`/api/tasks/${taskId}/retry`, { method: "POST" });
            window.location.reload();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  const stepIndex = getStepIndex(task.status);

  return (
    <div className="space-y-6">
      {/* Step indicators */}
      <div className="flex items-center justify-between">
        {steps.map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-all ${
              i < stepIndex ? "bg-green-500/20 text-green-500" :
              i === stepIndex ? "bg-primary/20 text-primary animate-pulse" :
              "bg-muted text-muted-foreground"
            }`}>
              {i < stepIndex ? "✓" : i + 1}
            </div>
            <span className={`text-sm ${i <= stepIndex ? "text-foreground" : "text-muted-foreground"}`}>
              {step}
            </span>
            {i < steps.length - 1 && (
              <div className={`mx-2 h-px w-8 transition-colors ${i < stepIndex ? "bg-green-500/50" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <Progress value={task.progress} />
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{task.current_step}</span>
          <span className="flex items-center gap-3">
            {eta && <span className="text-xs">{eta}</span>}
            <span>{task.progress}%</span>
          </span>
        </div>
      </div>
    </div>
  );
}
