"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { FilePicker } from "@/components/file-picker";
import { VideoPreview } from "@/components/video-preview";
import { ProcessingPanel } from "@/components/processing-panel";
import { ResultPanel } from "@/components/result-panel";
import { Timeline } from "@/components/timeline";
import { SettingsDrawer } from "@/components/settings-drawer";
import { useTaskSSE } from "@/hooks/use-task-sse";
import { LogTerminal } from "@/components/log-terminal";
import { Button } from "@/components/ui/button";
import { Scissors, Sparkles, Wand2 } from "lucide-react";
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
  const [mode, setMode] = useState<TaskMode>("both");
  const [silenceThreshold, setSilenceThreshold] = useState(3);
  const [keepFillers, setKeepFillers] = useState(false);
  const [subtitleStyle, setSubtitleStyle] = useState<"default" | "large-center">("default");
  const [burnSubtitles, setBurnSubtitles] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { task, segments, clips, logs, reset: resetSSE } = useTaskSSE(
    pageStatus === "processing" ? taskId : null
  );

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

  const handleStart = useCallback(async () => {
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
          config: {
            silence_threshold: silenceThreshold,
            keep_fillers: keepFillers,
            subtitle_style: subtitleStyle,
            burn_subtitles: burnSubtitles,
          } satisfies TaskConfig,
        }),
      });
      if (!res.ok) throw new Error("Failed to create task");
      const { id } = await res.json();
      setTaskId(id);
      setPageStatus("processing");
    } catch {
      setPageStatus("failed");
    }
  }, [videoInfo, mode, silenceThreshold, keepFillers, subtitleStyle, burnSubtitles, resetSSE]);

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

  const isProcessing = pageStatus === "processing";

  return (
    <div className="flex flex-col h-screen bg-[#0f0f1a] text-[#f0f0f5]">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-2.5 border-b border-[#3a3a5a] bg-gradient-to-r from-[#1e1b4b] to-[#1a1a2e]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6366f1] to-[#a855f7] flex items-center justify-center shadow-lg shadow-purple-500/20">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-[#6366f1] to-[#a855f7] bg-clip-text text-transparent">
            ClipWise
          </span>
        </div>
        <div className="flex items-center gap-2">
          {pageStatus !== "idle" && (
            <Button
              size="sm"
              className="bg-[#252540] border border-[#3a3a5a] text-[#a0a0b8] hover:bg-[#6366f1] hover:text-white hover:border-[#6366f1] transition-all text-xs h-8"
              onClick={handleChangeFile}
            >
              更换文件
            </Button>
          )}
          <SettingsDrawer />
        </div>
      </header>

      {/* Main 3-column layout */}
      <div className="flex flex-1 min-h-0">
        {/* LEFT: Tools panel — always visible */}
        <aside className="w-[240px] bg-[#1a1a2e] border-r border-[#3a3a5a] p-4 overflow-y-auto flex flex-col gap-5">
          {/* Processing mode */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[#a0a0b8] mb-3 font-semibold">处理模式</div>
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: "clean" as TaskMode, icon: Scissors, label: "清理" },
                { key: "highlights" as TaskMode, icon: Sparkles, label: "高光" },
                { key: "both" as TaskMode, icon: Wand2, label: "全部" },
              ]).map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  disabled={isProcessing}
                  onClick={() => setMode(key)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-xs font-medium ${
                    mode === key
                      ? "bg-[#6366f1] border-[#6366f1] text-white shadow-lg shadow-purple-500/20"
                      : "bg-[#252540] border-[#3a3a5a] text-[#a0a0b8] hover:bg-[#6366f1]/20 hover:border-[#6366f1]/50"
                  } ${key === "both" ? "col-span-2" : ""} ${isProcessing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Parameters */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[#a0a0b8] mb-3 font-semibold">参数设置</div>
            <div className="space-y-4">
              {/* Silence threshold */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-xs text-[#a0a0b8]">静音阈值</span>
                  <span className="text-xs text-[#6366f1] font-medium">{silenceThreshold}s</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="10"
                  step="0.5"
                  value={silenceThreshold}
                  onChange={(e) => setSilenceThreshold(Number(e.target.value))}
                  disabled={isProcessing}
                  className="w-full h-1.5 rounded-full appearance-none bg-[#252540] accent-[#6366f1] cursor-pointer disabled:opacity-50"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-[#a0a0b8]/60">0.5s</span>
                  <span className="text-[10px] text-[#a0a0b8]/60">10s</span>
                </div>
              </div>

              {/* Keep fillers */}
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs text-[#a0a0b8]">保留填充词</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={keepFillers}
                    onChange={(e) => setKeepFillers(e.target.checked)}
                    disabled={isProcessing}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#252540] rounded-full peer-checked:bg-[#6366f1] transition-colors border border-[#3a3a5a]" />
                  <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4 shadow" />
                </div>
              </label>

              {/* Subtitle style */}
              <div>
                <span className="text-xs text-[#a0a0b8] block mb-1.5">字幕样式</span>
                <select
                  value={subtitleStyle}
                  onChange={(e) => setSubtitleStyle(e.target.value as "default" | "large-center")}
                  disabled={isProcessing}
                  className="w-full bg-[#252540] border border-[#3a3a5a] rounded-lg px-3 py-2 text-xs text-[#f0f0f5] focus:border-[#6366f1] focus:outline-none disabled:opacity-50"
                >
                  <option value="default">默认 (18px)</option>
                  <option value="large-center">大号居中 (24px)</option>
                </select>
              </div>

              {/* Burn subtitles */}
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs text-[#a0a0b8]">烧录字幕</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={burnSubtitles}
                    onChange={(e) => setBurnSubtitles(e.target.checked)}
                    disabled={isProcessing}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#252540] rounded-full peer-checked:bg-[#6366f1] transition-colors border border-[#3a3a5a]" />
                  <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4 shadow" />
                </div>
              </label>
            </div>
          </div>

          {/* Start button */}
          {pageStatus === "uploaded" && (
            <Button
              className="w-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] hover:from-[#5558e6] hover:to-[#7c4ff0] text-white font-semibold shadow-lg shadow-purple-500/25 transition-all hover:-translate-y-0.5"
              size="lg"
              onClick={handleStart}
            >
              开始处理
            </Button>
          )}

          {/* Video info when uploaded */}
          {videoInfo && pageStatus !== "idle" && (
            <div className="mt-auto">
              <div className="text-[11px] uppercase tracking-wider text-[#a0a0b8] mb-2 font-semibold">视频信息</div>
              <div className="bg-[#252540] rounded-xl p-3 border border-[#3a3a5a] space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-[#a0a0b8]">分辨率</span><span>{videoInfo.resolution}</span></div>
                <div className="flex justify-between"><span className="text-[#a0a0b8]">时长</span><span>{Math.floor(videoInfo.duration / 60)}:{Math.floor(videoInfo.duration % 60).toString().padStart(2, "0")}</span></div>
                <div className="flex justify-between"><span className="text-[#a0a0b8]">文件</span><span className="truncate max-w-[120px]">{videoInfo.filename}</span></div>
              </div>
            </div>
          )}
        </aside>

        {/* CENTER: Video preview */}
        <main className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 flex items-center justify-center p-4">
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

          {/* Timeline */}
          {pageStatus !== "idle" && videoInfo && (
            <Timeline
              videoRef={videoRef}
              duration={videoInfo.duration}
              segments={segments}
              clips={clips}
            />
          )}
        </main>

        {/* RIGHT: Status/Results panel */}
        <aside className="w-[280px] bg-[#1a1a2e] border-l border-[#3a3a5a] flex flex-col min-h-0 overflow-y-auto">
          {pageStatus === "idle" && (
            <div className="p-5 text-xs text-[#a0a0b8] space-y-3">
              <div className="p-4 rounded-xl bg-gradient-to-br from-[#252540] to-[#1e1b4b] border border-[#3a3a5a]">
                <p className="font-semibold text-sm text-[#f0f0f5] mb-2">AI 视频处理工作台</p>
                <p className="leading-relaxed">选择视频文件开始。ClipWise 会自动分析并处理你的视频。</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" />蓝色 = 有语音内容</div>
                <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />红色 = 将被删除</div>
                <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />绿色 = 高光片段</div>
              </div>
            </div>
          )}
          {pageStatus === "uploaded" && (
            <div className="p-5 text-xs text-[#a0a0b8]">
              <div className="p-4 rounded-xl bg-[#252540] border border-[#3a3a5a]">
                <p className="font-semibold text-sm text-[#f0f0f5] mb-1">准备就绪</p>
                <p>调整左侧参数后点击「开始处理」</p>
              </div>
            </div>
          )}
          {(pageStatus === "processing" || pageStatus === "failed") && (
            <>
              <ProcessingPanel task={task} segments={segments} />
              <div className="flex-1 min-h-0 p-3 pt-0">
                <LogTerminal logs={logs} />
              </div>
            </>
          )}
          {pageStatus === "failed" && (
            <div className="p-4 border-t border-[#3a3a5a]">
              <p className="text-xs text-red-400 mb-2">{task?.error || "处理失败"}</p>
              <Button
                size="sm"
                className="w-full bg-[#252540] border border-[#3a3a5a] hover:bg-[#6366f1] text-xs"
                onClick={handleReprocess}
              >
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
        </aside>
      </div>
    </div>
  );
}
