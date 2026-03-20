"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ProgressDisplay } from "@/components/progress-display";
import { VideoPlayer } from "@/components/video-player";
import { ClipCard } from "@/components/clip-card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  filename: string;
  mode: string;
  status: string;
  progress: number;
  current_step: string;
  result: string | null;
  error: string | null;
}

interface TaskResult {
  cleaned_video?: string;
  subtitle_file?: string;
  clips?: Array<{
    title: string;
    filepath: string;
    subtitle_file: string;
    duration: number;
    score: number;
  }>;
}

export default function TaskPage() {
  const params = useParams();
  const taskId = params.id as string;
  const [task, setTask] = useState<Task | null>(null);

  useEffect(() => {
    fetch(`/api/tasks/${taskId}`)
      .then((res) => res.json())
      .then(setTask);
  }, [taskId]);

  // Auto-refresh when SSE reports completion
  useEffect(() => {
    if (!task || ["completed", "failed"].includes(task.status)) return;

    const evtSource = new EventSource(`/api/tasks/${taskId}/sse`);
    evtSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.status === "completed" || data.status === "failed") {
          evtSource.close();
          // Re-fetch full task data
          fetch(`/api/tasks/${taskId}`)
            .then((res) => res.json())
            .then(setTask);
        }
      } catch {}
    };
    evtSource.onerror = () => evtSource.close();
    return () => evtSource.close();
  }, [task?.status, taskId]);

  if (!task) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">加载中...</p>
      </div>
    );
  }

  const isProcessing = !["completed", "failed"].includes(task.status);
  const result: TaskResult | null = task.result ? JSON.parse(task.result) : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{task.filename}</h1>
        <div className="mt-1 flex items-center gap-2">
          <Badge variant={task.status === "completed" ? "default" : task.status === "failed" ? "destructive" : "secondary"}>
            {task.status}
          </Badge>
          <Badge variant="outline">{task.mode}</Badge>
        </div>
      </div>

      {isProcessing && <ProgressDisplay taskId={taskId} />}

      {task.status === "completed" && result && (
        <div className="space-y-8">
          {/* Cleaned video */}
          {result.cleaned_video && (
            <section className="space-y-4">
              <h2 className="text-xl font-semibold">清理后的视频</h2>
              <VideoPlayer src={`/api/tasks/${taskId}/download?type=cleaned`} />
              <div className="flex gap-3">
                <a
                  href={`/api/tasks/${taskId}/download?type=cleaned`}
                  download
                  className={cn(buttonVariants())}
                >
                  下载视频
                </a>
                {result.subtitle_file && (
                  <a
                    href={`/api/tasks/${taskId}/download?type=subtitle`}
                    download
                    className={cn(buttonVariants({ variant: "outline" }))}
                  >
                    下载字幕
                  </a>
                )}
              </div>
            </section>
          )}

          {/* Clips */}
          {result.clips && result.clips.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-semibold">精华片段（{result.clips.length}）</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {result.clips.map((clip, i) => (
                  <ClipCard
                    key={i}
                    title={clip.title}
                    duration={clip.duration}
                    score={clip.score}
                    previewUrl={`/api/tasks/${taskId}/download?type=cleaned`}
                    downloadUrl={`/api/tasks/${taskId}/download?type=clips`}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Actions */}
          <div className="flex items-center justify-center gap-4 border-t border-border pt-6">
            <a
              href={`/api/tasks/${taskId}/download?type=all`}
              download
              className={cn(buttonVariants({ size: "lg" }))}
            >
              下载全部 (ZIP)
            </a>
            <Link
              href="/"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              新任务
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
