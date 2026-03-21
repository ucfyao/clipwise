"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { FilePicker } from "@/components/file-picker";
import { VideoPreview } from "@/components/video-preview";
import { ConfigPanel } from "@/components/config-panel";
import { ProcessingPanel } from "@/components/processing-panel";
import { ResultPanel } from "@/components/result-panel";
import { Timeline } from "@/components/timeline";
import { SettingsDrawer } from "@/components/settings-drawer";
import { useTaskSSE } from "@/hooks/use-task-sse";
import { Button } from "@/components/ui/button";
import type { PageStatus, TaskConfig, TaskMode, TaskResult } from "@/lib/schema";

interface VideoInfo {
  filename: string;
  filepath: string;
  previewUrl: string;
  duration: number;
  resolution: string;
  size: string;
}

export default function Home() {
  const [pageStatus, setPageStatus] = useState<PageStatus>("idle");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskResult, setTaskResult] = useState<TaskResult | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { task, segments, clips, reset: resetSSE } = useTaskSSE(
    pageStatus === "processing" ? taskId : null
  );

  // Detect completion/failure from SSE — must be in useEffect, not render body
  useEffect(() => {
    if (task?.status === "completed" && pageStatus === "processing") {
      setPageStatus("done");
      if (task.result) {
        try { setTaskResult(JSON.parse(task.result as string)); } catch {}
      }
    }
    if (task?.status === "failed" && pageStatus === "processing") {
      setPageStatus("failed");
    }
  }, [task?.status, task?.result, pageStatus]);

  const handleFileReady = useCallback((data: { filename: string; filepath: string; previewUrl: string; duration: number }) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      setVideoInfo({
        ...data,
        resolution: `${video.videoWidth}x${video.videoHeight}`,
        size: "—",
      });
      setPageStatus("uploaded");
    };
    video.src = data.previewUrl;
  }, []);

  const handleStart = useCallback(async (mode: TaskMode, config: TaskConfig) => {
    if (!videoInfo) return;
    resetSSE();

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: videoInfo.filename,
          filepath: videoInfo.filepath,
          mode,
          config,
        }),
      });
      if (!res.ok) throw new Error("Failed to create task");
      const { id } = await res.json();
      setTaskId(id);
      setPageStatus("processing");
    } catch {
      setPageStatus("failed");
    }
  }, [videoInfo, resetSSE]);

  const handleReprocess = useCallback(() => {
    setPageStatus("uploaded");
    setTaskResult(null);
    setTaskId(null);
    resetSSE();
  }, [resetSSE]);

  const handleChangeFile = useCallback(() => {
    setPageStatus("idle");
    setVideoInfo(null);
    setTaskResult(null);
    setTaskId(null);
    resetSSE();
  }, [resetSSE]);

  const cleanedVideoUrl = taskResult?.cleaned_video
    ? `/api/tasks/${taskId}/download?type=cleaned`
    : undefined;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b">
        <h1 className="text-xl font-bold">ClipWise</h1>
        <div className="flex items-center gap-2">
          {pageStatus !== "idle" && (
            <Button variant="ghost" size="sm" onClick={handleChangeFile}>
              更换文件
            </Button>
          )}
          <SettingsDrawer />
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Video area */}
        <div className="flex-1 flex items-center justify-center p-6">
          {pageStatus === "idle" ? (
            <FilePicker onFileReady={handleFileReady} />
          ) : videoInfo ? (
            <VideoPreview
              ref={videoRef}
              previewUrl={videoInfo.previewUrl}
              cleanedVideoUrl={cleanedVideoUrl}
            />
          ) : null}
        </div>

        {/* Right: Panel */}
        <div className="w-80 border-l flex flex-col min-h-0">
          {pageStatus === "idle" && (
            <div className="p-4 text-sm text-muted-foreground">
              <p className="mb-2">选择视频文件开始处理</p>
              <p>ClipWise 会自动去除静音和填充词，提取高光片段，生成字幕和发布文案。</p>
            </div>
          )}
          {pageStatus === "uploaded" && videoInfo && (
            <ConfigPanel
              videoInfo={{
                resolution: videoInfo.resolution,
                duration: videoInfo.duration,
                size: videoInfo.size,
              }}
              onStart={handleStart}
            />
          )}
          {(pageStatus === "processing" || pageStatus === "failed") && (
            <ProcessingPanel task={task} segments={segments} />
          )}
          {pageStatus === "failed" && (
            <div className="p-4 border-t">
              <p className="text-sm text-red-500 mb-2">{task?.error || "处理失败"}</p>
              <Button variant="outline" className="w-full" onClick={handleReprocess}>
                重试
              </Button>
            </div>
          )}
          {pageStatus === "done" && taskResult && taskId && (
            <ResultPanel
              taskId={taskId}
              result={taskResult}
              onReprocess={handleReprocess}
            />
          )}
        </div>
      </div>

      {/* Timeline */}
      {pageStatus !== "idle" && videoInfo && (
        <Timeline
          videoRef={videoRef}
          duration={videoInfo.duration}
          segments={segments}
          clips={clips}
        />
      )}
    </div>
  );
}
