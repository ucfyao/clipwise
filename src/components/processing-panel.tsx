"use client";

import { useMemo, useRef } from "react";
import { Check, Loader2, Circle } from "lucide-react";
import type { Task, TimelineSegment } from "@/lib/schema";

interface ProcessingPanelProps {
  task: Partial<Task> | null;
  segments: TimelineSegment[];
}

const STEPS = [
  { key: "transcribing", label: "转录" },
  { key: "analyzing", label: "分析" },
  { key: "processing", label: "处理" },
  { key: "completed", label: "完成" },
];

export function ProcessingPanel({ task, segments }: ProcessingPanelProps) {
  const startTimeRef = useRef(Date.now());
  const progress = task?.progress ?? 0;
  const status = task?.status ?? "pending";

  const eta = useMemo(() => {
    if (progress <= 0 || progress >= 100) return null;
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const remaining = (elapsed / (progress / 100)) - elapsed;
    if (remaining < 60) return `~${Math.ceil(remaining)}s`;
    return `~${Math.ceil(remaining / 60)}min`;
  }, [progress]);

  const stats = useMemo(() => {
    if (segments.length === 0) return null;
    const silenceCount = segments.filter((s) => s.type === "silence").length;
    const fillerCount = segments.filter((s) => s.type === "filler").length;
    const removeDuration = segments
      .filter((s) => s.type === "silence" || s.type === "filler")
      .reduce((acc, s) => acc + (s.end - s.start), 0);
    return { silenceCount, fillerCount, removeDuration };
  }, [segments]);

  const getStepStatus = (stepKey: string) => {
    const order = STEPS.map((s) => s.key);
    const currentIdx = order.indexOf(status);
    const stepIdx = order.indexOf(stepKey);
    if (stepIdx < currentIdx) return "done";
    if (stepIdx === currentIdx) return "active";
    return "pending";
  };

  return (
    <div className="flex flex-col gap-6 p-4 h-full">
      <div className="space-y-3">
        {STEPS.map((step) => {
          const s = getStepStatus(step.key);
          return (
            <div key={step.key} className="flex items-center gap-3">
              {s === "done" && <Check className="w-4 h-4 text-green-500" />}
              {s === "active" && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
              {s === "pending" && <Circle className="w-4 h-4 text-muted-foreground/40" />}
              <span className={s === "active" ? "text-primary font-medium" : s === "done" ? "text-muted-foreground" : "text-muted-foreground/40"}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      <div>
        <div className="flex justify-between text-sm mb-1.5">
          <span className="text-muted-foreground">{task?.current_step || "准备中..."}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        {eta && <div className="text-xs text-muted-foreground mt-1">预计剩余: {eta}</div>}
      </div>

      {stats && (
        <div className="border rounded-lg p-3 space-y-1.5">
          <h4 className="text-sm font-medium mb-2">实时发现</h4>
          <div className="text-sm flex justify-between">
            <span className="text-muted-foreground">静音段落</span>
            <span>{stats.silenceCount} 段</span>
          </div>
          {stats.fillerCount > 0 && (
            <div className="text-sm flex justify-between">
              <span className="text-muted-foreground">填充词</span>
              <span>{stats.fillerCount} 段</span>
            </div>
          )}
          <div className="text-sm flex justify-between">
            <span className="text-muted-foreground">将删除</span>
            <span>{stats.removeDuration.toFixed(1)}s</span>
          </div>
        </div>
      )}
    </div>
  );
}
