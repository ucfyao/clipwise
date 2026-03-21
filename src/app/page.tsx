"use client";

import { useState, useEffect } from "react";
import { UploadZone } from "@/components/upload-zone";
import { TaskConfigPanel } from "@/components/task-config";
import { VideoTrimmer } from "@/components/video-trimmer";
import { ProgressDisplay } from "@/components/progress-display";
import { VideoPlayer } from "@/components/video-player";
import { ClipCard } from "@/components/clip-card";
import { CopyPanel } from "@/components/copy-panel";
import { SettingsDrawer } from "@/components/settings-drawer";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TaskConfig {
  silence_threshold: number;
  keep_fillers: boolean;
  subtitle_style: "default" | "large-center";
  burn_subtitles: boolean;
}

const DEFAULT_CONFIG: TaskConfig = {
  silence_threshold: 3,
  keep_fillers: false,
  subtitle_style: "default" as const,
  burn_subtitles: false,
};

interface TaskResult {
  cleaned_video?: string;
  subtitle_file?: string;
  srt_file?: string;
  clips?: Array<{
    title: string;
    filepath: string;
    subtitle_file: string;
    duration: number;
    score: number;
  }>;
  copy?: Array<{
    clip_title: string;
    platforms: Array<{
      platform: string;
      title: string;
      description: string;
      hashtags: string[];
    }>;
  }>;
}

type Step = "upload" | "config" | "processing" | "done" | "failed";

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [uploadResult, setUploadResult] = useState<{ filename: string; filepath: string } | null>(null);
  const [config, setConfig] = useState<TaskConfig>(DEFAULT_CONFIG);
  const [mode, setMode] = useState<"clean" | "highlights" | "both">("both");
  const [loading, setLoading] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [trim, setTrim] = useState({ enabled: false, start: 0, end: 0 });
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskResult, setTaskResult] = useState<TaskResult | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);

  // Listen for task completion via SSE
  useEffect(() => {
    if (!taskId || step !== "processing") return;

    const evtSource = new EventSource(`/api/tasks/${taskId}/sse`);
    evtSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.status === "completed") {
          evtSource.close();
          fetch(`/api/tasks/${taskId}`)
            .then((res) => res.json())
            .then((task) => {
              setTaskResult(task.result ? JSON.parse(task.result) : null);
              setStep("done");
            });
        } else if (data.status === "failed") {
          evtSource.close();
          setTaskError(data.error || "处理失败");
          setStep("failed");
        }
      } catch {}
    };
    evtSource.onerror = () => evtSource.close();
    return () => evtSource.close();
  }, [taskId, step]);

  const handleUpload = (result: { filename: string; filepath: string }) => {
    setUploadResult(result);
    setStep("config");
  };

  const handleStart = async () => {
    if (!uploadResult) return;
    setLoading(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...uploadResult,
          mode,
          config,
          trim: trim.enabled ? { start: trim.start, end: trim.end } : undefined,
        }),
      });
      const { id } = await res.json();
      setTaskId(id);
      setStep("processing");
    } catch {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep("upload");
    setUploadResult(null);
    setConfig(DEFAULT_CONFIG);
    setMode("both");
    setLoading(false);
    setVideoDuration(0);
    setPreviewUrl(null);
    setTrim({ enabled: false, start: 0, end: 0 });
    setTaskId(null);
    setTaskResult(null);
    setTaskError(null);
  };

  const handleRetry = async () => {
    if (!taskId) return;
    setTaskError(null);
    setStep("processing");
    await fetch(`/api/tasks/${taskId}/retry`, { method: "POST" });
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ClipWise</h1>
          <p className="text-sm text-muted-foreground">一键视频剪辑</p>
        </div>
        <SettingsDrawer />
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <UploadZone
          onUpload={handleUpload}
          onDurationDetected={setVideoDuration}
          onPreviewReady={setPreviewUrl}
        />
      )}

      {/* Step 2: Config */}
      {step === "config" && uploadResult && (
        <div className="space-y-6">
          {/* Show uploaded file info */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{uploadResult.filename}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              更换文件
            </Button>
          </div>

          {previewUrl && videoDuration > 0 && (
            <VideoTrimmer
              videoUrl={previewUrl}
              duration={videoDuration}
              onTrimChange={setTrim}
            />
          )}

          <TaskConfigPanel mode={mode} setMode={setMode} config={config} setConfig={setConfig} />

          <Button
            onClick={handleStart}
            disabled={loading}
            size="lg"
            className="w-full"
          >
            {loading ? "提交中..." : "开始处理"}
          </Button>
        </div>
      )}

      {/* Video preview — visible during processing & failed */}
      {(step === "processing" || step === "failed") && previewUrl && (
        <div className="space-y-2">
          <video src={previewUrl} controls className="w-full rounded-lg" />
          <p className="truncate text-sm text-muted-foreground">{uploadResult?.filename}</p>
        </div>
      )}

      {/* Step 3: Processing */}
      {step === "processing" && taskId && (
        <ProgressDisplay taskId={taskId} />
      )}

      {/* Step 4: Failed */}
      {step === "failed" && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="text-sm font-medium text-destructive">处理失败</p>
          {taskError && <p className="mt-2 text-sm text-muted-foreground">{taskError}</p>}
          <div className="mt-4 flex justify-center gap-3">
            <Button variant="outline" size="sm" onClick={handleRetry}>重试</Button>
            <Button variant="ghost" size="sm" onClick={handleReset}>重新上传</Button>
          </div>
        </div>
      )}

      {/* Step 5: Done */}
      {step === "done" && taskResult && taskId && (
        <div className="space-y-8">
          {/* Cleaned video */}
          {taskResult.cleaned_video && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold">清理后的视频</h2>
              <VideoPlayer src={`/api/tasks/${taskId}/download?type=cleaned`} />
              <div className="flex gap-3">
                <a
                  href={`/api/tasks/${taskId}/download?type=cleaned`}
                  download
                  className={cn(buttonVariants({ size: "sm" }))}
                >
                  下载视频
                </a>
                {taskResult.subtitle_file && (
                  <a
                    href={`/api/tasks/${taskId}/download?type=subtitle`}
                    download
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    下载字幕
                  </a>
                )}
              </div>
            </section>
          )}

          {/* Clips */}
          {taskResult.clips && taskResult.clips.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold">精华片段（{taskResult.clips.length}）</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {taskResult.clips.map((clip, i) => (
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

          {/* Copy panel */}
          {taskResult.copy && taskResult.copy.length > 0 && (
            <CopyPanel copies={taskResult.copy} />
          )}

          {/* Actions */}
          <div className="flex items-center justify-center gap-4 border-t border-border pt-6">
            <a
              href={`/api/tasks/${taskId}/download?type=all`}
              download
              className={cn(buttonVariants())}
            >
              下载全部 (ZIP)
            </a>
            <Button variant="outline" onClick={handleReset}>
              处理新视频
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
