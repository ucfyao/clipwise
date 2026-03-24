"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { FilePicker } from "@/components/file-picker";
import { VideoPreview } from "@/components/video-preview";
import { ProcessingPanel } from "@/components/processing-panel";
import { ResultPanel } from "@/components/result-panel";
import { Timeline } from "@/components/timeline";
import { SettingsDrawer } from "@/components/settings-drawer";
import { useTaskSSE, type LogEntry } from "@/hooks/use-task-sse";
import { LogTerminal } from "@/components/log-terminal";
import { Button } from "@/components/ui/button";
import { Scissors, Sparkles, Wand2 } from "lucide-react";
import type { PageStatus, TaskConfig, TaskMode, TaskResult, TimelineSegment } from "@/lib/schema";

interface VideoInfo {
  filename: string;
  filepath: string;
  previewUrl: string;
  duration: number;
  resolution: string;
  size: string;
}

function Home() {
  const [pageStatus, setPageStatus] = useState<PageStatus>("idle");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskResult, setTaskResult] = useState<TaskResult | null>(null);
  const [mode, setMode] = useState<TaskMode>("clean");
  const [silenceThreshold, setSilenceThreshold] = useState(3);
  const [keepFillers, setKeepFillers] = useState(false);
  const [subtitleStyle, setSubtitleStyle] = useState<"default" | "large-center">("default");
  const [burnSubtitles, setBurnSubtitles] = useState(false);
  const [normalizeAudio, setNormalizeAudio] = useState(false);
  const [denoise, setDenoise] = useState<"off" | "light" | "medium" | "strong">("off");
  const [speed, setSpeed] = useState(1);
  const [fadeEnabled, setFadeEnabled] = useState(false);
  const [fadeDuration, setFadeDuration] = useState(1);
  const [clientLogs, setClientLogs] = useState<LogEntry[]>([]);
  const [waveformUrl, setWaveformUrl] = useState<string | null>(null);
  const [editedSegments, setEditedSegments] = useState<TimelineSegment[] | null>(null);
  const [outputQuality, setOutputQuality] = useState<"high" | "medium" | "low">("high");
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const addLog = useCallback((message: string, level: "info" | "warn" | "error" = "info") => {
    const now = new Date();
    const timestamp = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
    setClientLogs((prev) => [...prev, { timestamp, level, message: `[${timestamp}] ${message}` }]);
  }, []);

  // Connect SSE whenever we have a taskId and status isn't idle/uploaded
  const sseActive = taskId && (pageStatus === "processing" || pageStatus === "failed");
  const { task, segments, clips, logs, reset: resetSSE } = useTaskSSE(
    sseActive ? taskId : null
  );

  // Merge client-side logs with SSE logs
  const localLogs = [...clientLogs, ...logs];

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
    addLog(`文件已选择: ${data.filename}`);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      setVideoInfo({
        ...data,
        resolution: `${video.videoWidth}x${video.videoHeight}`,
        size: "—",
      });
      addLog(`视频信息: ${video.videoWidth}x${video.videoHeight}, ${Math.floor(data.duration)}s`);
      addLog("准备就绪，等待开始处理");
      setPageStatus("uploaded");

      // Generate waveform in background
      fetch("/api/waveform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filepath: data.filepath }),
      })
        .then((res) => res.json())
        .then((result) => {
          if (result.dataUrl) setWaveformUrl(result.dataUrl);
        })
        .catch(() => {}); // Non-critical, ignore errors
    };
    video.src = data.previewUrl;
  }, [addLog]);

  const handleStart = useCallback(async () => {
    if (!videoInfo) return;
    setClientLogs([]);
    resetSSE();
    addLog(`开始处理: ${videoInfo.filename}`);
    addLog(`模式: ${mode}, 静音阈值: ${silenceThreshold}s`);

    try {
      addLog("创建任务...");
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
            normalize_audio: normalizeAudio,
            denoise,
            speed,
            fade: { enabled: fadeEnabled, duration: fadeDuration },
            output_quality: outputQuality,
            trim: trimStart > 0 || (trimEnd > 0 && trimEnd < videoInfo.duration)
              ? { start: trimStart, end: trimEnd || videoInfo.duration }
              : undefined,
          } satisfies TaskConfig,
        }),
      });
      if (!res.ok) throw new Error("Failed to create task");
      const { id } = await res.json();
      addLog(`任务已创建: ${id}`);
      addLog("连接 SSE 实时日志流...");
      setTaskId(id);
      setPageStatus("processing");
    } catch {
      addLog("任务创建失败", "error");
      setPageStatus("failed");
    }
  }, [videoInfo, mode, silenceThreshold, keepFillers, subtitleStyle, burnSubtitles, normalizeAudio, denoise, speed, fadeEnabled, fadeDuration, outputQuality, trimStart, trimEnd, resetSSE, addLog]);

  const handleReprocess = useCallback(() => {
    setPageStatus("uploaded");
    setTaskResult(null);
    setTaskId(null);
    setEditedSegments(null);
    resetSSE();
  }, [resetSSE]);

  const handleChangeFile = useCallback(() => {
    setPageStatus("idle");
    setVideoInfo(null);
    setTaskResult(null);
    setTaskId(null);
    setWaveformUrl(null);
    setEditedSegments(null);
    setTrimStart(0);
    setTrimEnd(0);
    resetSSE();
  }, [resetSSE]);

  const handleReExport = useCallback(async () => {
    if (!taskId || !editedSegments) return;
    addLog("Re-exporting with edited segments...");
    setPageStatus("processing");
    try {
      const res = await fetch(`/api/tasks/${taskId}/re-export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segments: editedSegments }),
      });
      if (!res.ok) throw new Error("Re-export failed");
      addLog("Re-export started");
    } catch {
      addLog("Re-export request failed", "error");
      setPageStatus("failed");
    }
  }, [taskId, editedSegments, addLog]);

  const cleanedVideoUrl = taskResult?.cleaned_video
    ? `/api/tasks/${taskId}/stream`
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
                { key: "clean" as TaskMode, icon: Scissors, label: "清理", tip: "去除静音段落，生成字幕。无 API Key 时使用基础静音检测（无填充词识别）" },
                { key: "highlights" as TaskMode, icon: Sparkles, label: "高光", tip: "AI 提取精彩片段，自动裁剪为竖屏短视频，生成多平台文案。需要 API Key" },
                { key: "both" as TaskMode, icon: Wand2, label: "清理+高光", tip: "先清理再提取高光，完整处理流程。高光功能需要 API Key" },
              ]).map(({ key, icon: Icon, label, tip }) => (
                <div key={key} className={`relative group ${key === "both" ? "col-span-2" : ""}`}>
                  <button
                    disabled={isProcessing}
                    onClick={() => setMode(key)}
                    className={`w-full flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-xs font-medium ${
                      mode === key
                        ? "bg-[#6366f1] border-[#6366f1] text-white shadow-lg shadow-purple-500/20"
                        : "bg-[#252540] border-[#3a3a5a] text-[#a0a0b8] hover:bg-[#6366f1]/20 hover:border-[#6366f1]/50"
                    } ${isProcessing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <Icon className="w-5 h-5" />
                    {label}
                  </button>
                  {/* Tooltip */}
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-52 p-2.5 bg-[#0f0f1a] border border-[#3a3a5a] rounded-lg text-[10px] text-[#a0a0b8] leading-relaxed opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-xl pointer-events-none">
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[#3a3a5a]" />
                    {tip}
                  </div>
                </div>
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
                  <span className="text-xs text-[#a0a0b8] group/tip relative cursor-help">
                    静音阈值 <span className="inline-block w-3 h-3 rounded-full bg-[#3a3a5a] text-[8px] text-center leading-3 ml-0.5">?</span>
                    <span className="absolute left-0 bottom-full mb-1.5 w-44 p-2 bg-[#0f0f1a] border border-[#3a3a5a] rounded-lg text-[10px] leading-relaxed opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all z-50 shadow-xl">超过该时长的静音段落会被删除。值越小删除越激进。</span>
                  </span>
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
                <span className="text-xs text-[#a0a0b8] group/tip relative cursor-help">
                  保留填充词 <span className="inline-block w-3 h-3 rounded-full bg-[#3a3a5a] text-[8px] text-center leading-3 ml-0.5">?</span>
                  <span className="absolute left-0 bottom-full mb-1.5 w-44 p-2 bg-[#0f0f1a] border border-[#3a3a5a] rounded-lg text-[10px] leading-relaxed opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all z-50 shadow-xl">开启后保留"嗯""那个"等口语化表达，关闭则自动删除。需要 API Key。</span>
                </span>
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
                <span className="text-xs text-[#a0a0b8] block mb-1.5 group/tip relative cursor-help w-fit">
                  字幕样式 <span className="inline-block w-3 h-3 rounded-full bg-[#3a3a5a] text-[8px] text-center leading-3 ml-0.5">?</span>
                  <span className="absolute left-0 bottom-full mb-1.5 w-44 p-2 bg-[#0f0f1a] border border-[#3a3a5a] rounded-lg text-[10px] leading-relaxed opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all z-50 shadow-xl">生成的 ASS 字幕样式。大号居中适合竖屏短视频。</span>
                </span>
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
                <span className="text-xs text-[#a0a0b8] group/tip relative cursor-help">
                  烧录字幕 <span className="inline-block w-3 h-3 rounded-full bg-[#3a3a5a] text-[8px] text-center leading-3 ml-0.5">?</span>
                  <span className="absolute left-0 bottom-full mb-1.5 w-44 p-2 bg-[#0f0f1a] border border-[#3a3a5a] rounded-lg text-[10px] leading-relaxed opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all z-50 shadow-xl">将字幕硬编码到视频中。关闭则单独输出字幕文件。</span>
                </span>
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

          {/* 音视频增强 */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[#a0a0b8] mb-3 font-semibold mt-2">音视频增强</div>
            <div className="space-y-4">
              {/* Normalize audio */}
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs text-[#a0a0b8] group/tip relative cursor-help">
                  音量标准化 <span className="inline-block w-3 h-3 rounded-full bg-[#3a3a5a] text-[8px] text-center leading-3 ml-0.5">?</span>
                  <span className="absolute left-0 bottom-full mb-1.5 w-44 p-2 bg-[#0f0f1a] border border-[#3a3a5a] rounded-lg text-[10px] leading-relaxed opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all z-50 shadow-xl">自动将音量标准化到 -16 LUFS，适合多段视频音量不一致的情况</span>
                </span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={normalizeAudio}
                    onChange={(e) => setNormalizeAudio(e.target.checked)}
                    disabled={isProcessing}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#252540] rounded-full peer-checked:bg-[#6366f1] transition-colors border border-[#3a3a5a]" />
                  <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4 shadow" />
                </div>
              </label>

              {/* Denoise */}
              <div>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs text-[#a0a0b8] group/tip relative cursor-help">
                    降噪 <span className="inline-block w-3 h-3 rounded-full bg-[#3a3a5a] text-[8px] text-center leading-3 ml-0.5">?</span>
                    <span className="absolute left-0 bottom-full mb-1.5 w-44 p-2 bg-[#0f0f1a] border border-[#3a3a5a] rounded-lg text-[10px] leading-relaxed opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all z-50 shadow-xl">去除背景噪音（风扇、空调等）</span>
                  </span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={denoise !== "off"}
                      onChange={(e) => setDenoise(e.target.checked ? "light" : "off")}
                      disabled={isProcessing}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-[#252540] rounded-full peer-checked:bg-[#6366f1] transition-colors border border-[#3a3a5a]" />
                    <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4 shadow" />
                  </div>
                </label>
                {denoise !== "off" && (
                  <select
                    value={denoise}
                    onChange={(e) => setDenoise(e.target.value as "light" | "medium" | "strong")}
                    disabled={isProcessing}
                    className="w-full bg-[#252540] border border-[#3a3a5a] rounded-lg px-3 py-2 text-xs text-[#f0f0f5] focus:border-[#6366f1] focus:outline-none disabled:opacity-50 mt-2"
                  >
                    <option value="light">轻度</option>
                    <option value="medium">中度</option>
                    <option value="strong">强力</option>
                  </select>
                )}
              </div>

              {/* Speed */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-xs text-[#a0a0b8]">播放速度</span>
                  <span className="text-xs text-[#6366f1] font-medium">{speed === 1 ? "原速" : `${speed}x`}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="2"
                  step="0.05"
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  disabled={isProcessing}
                  className="w-full h-1.5 rounded-full appearance-none bg-[#252540] accent-[#6366f1] cursor-pointer disabled:opacity-50"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-[#a0a0b8]/60">1x</span>
                  <span className="text-[10px] text-[#a0a0b8]/60">2x</span>
                </div>
              </div>

              {/* Fade in/out */}
              <div>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs text-[#a0a0b8] group/tip relative cursor-help">
                    淡入淡出 <span className="inline-block w-3 h-3 rounded-full bg-[#3a3a5a] text-[8px] text-center leading-3 ml-0.5">?</span>
                    <span className="absolute left-0 bottom-full mb-1.5 w-44 p-2 bg-[#0f0f1a] border border-[#3a3a5a] rounded-lg text-[10px] leading-relaxed opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all z-50 shadow-xl">在视频首尾添加渐显渐隐效果</span>
                  </span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={fadeEnabled}
                      onChange={(e) => setFadeEnabled(e.target.checked)}
                      disabled={isProcessing}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-[#252540] rounded-full peer-checked:bg-[#6366f1] transition-colors border border-[#3a3a5a]" />
                    <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4 shadow" />
                  </div>
                </label>
                {fadeEnabled && (
                  <div className="mt-2">
                    <div className="flex justify-between mb-2">
                      <span className="text-xs text-[#a0a0b8]">时长</span>
                      <span className="text-xs text-[#6366f1] font-medium">{fadeDuration}s</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="3"
                      step="0.5"
                      value={fadeDuration}
                      onChange={(e) => setFadeDuration(Number(e.target.value))}
                      disabled={isProcessing}
                      className="w-full h-1.5 rounded-full appearance-none bg-[#252540] accent-[#6366f1] cursor-pointer disabled:opacity-50"
                    />
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-[#a0a0b8]/60">0.5s</span>
                      <span className="text-[10px] text-[#a0a0b8]/60">3s</span>
                    </div>
                  </div>
                )}
              </div>
              {/* Output quality */}
              <div>
                <span className="text-xs text-[#a0a0b8] block mb-1.5">导出质量</span>
                <select
                  value={outputQuality}
                  onChange={(e) => setOutputQuality(e.target.value as "high" | "medium" | "low")}
                  disabled={isProcessing}
                  className="w-full bg-[#252540] border border-[#3a3a5a] rounded-lg px-3 py-2 text-xs text-[#f0f0f5] focus:border-[#6366f1] focus:outline-none disabled:opacity-50"
                >
                  <option value="high">高 (原始质量)</option>
                  <option value="medium">中 (4Mbps, max 1080p)</option>
                  <option value="low">低 (2Mbps, max 720p)</option>
                </select>
              </div>

              {/* Trim range */}
              {videoInfo && (
                <div>
                  <span className="text-xs text-[#a0a0b8] block mb-1.5">处理范围 (秒)</span>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      min={0}
                      max={trimEnd || videoInfo.duration}
                      step={1}
                      value={Math.floor(trimStart)}
                      onChange={(e) => setTrimStart(Number(e.target.value))}
                      disabled={isProcessing}
                      className="w-16 bg-[#252540] border border-[#3a3a5a] rounded px-2 py-1 text-xs text-[#f0f0f5]"
                    />
                    <span className="text-xs text-[#a0a0b8]">—</span>
                    <input
                      type="number"
                      min={trimStart}
                      max={videoInfo.duration}
                      step={1}
                      value={Math.floor(trimEnd || videoInfo.duration)}
                      onChange={(e) => setTrimEnd(Number(e.target.value))}
                      disabled={isProcessing}
                      className="w-16 bg-[#252540] border border-[#3a3a5a] rounded px-2 py-1 text-xs text-[#f0f0f5]"
                    />
                  </div>
                </div>
              )}
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
              segments={editedSegments ?? segments}
              clips={clips}
              waveformUrl={waveformUrl}
              editable={pageStatus === "done"}
              onSegmentsChange={(segs) => setEditedSegments(segs)}
            />
          )}
        </main>

        {/* RIGHT: Fixed-layout panel — content accumulates, never replaces */}
        <aside className="w-[280px] bg-[#1a1a2e] border-l border-[#3a3a5a] flex flex-col min-h-0">
          {/* Status bar — always visible */}
          <div className="px-4 py-2.5 border-b border-[#3a3a5a] flex items-center gap-2">
            {pageStatus === "idle" && (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-[#a0a0b8]" />
                <span className="text-xs text-[#a0a0b8]">等待选择文件</span>
              </>
            )}
            {pageStatus === "uploaded" && (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span className="text-xs text-[#f0f0f5]">就绪 — 点击「开始处理」</span>
              </>
            )}
            {pageStatus === "processing" && (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                <span className="text-xs text-[#f0f0f5]">{task?.current_step || "处理中..."}</span>
                <span className="text-xs text-[#6366f1] ml-auto">{task?.progress ?? 0}%</span>
              </>
            )}
            {pageStatus === "failed" && (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-xs text-red-400 truncate flex-1">失败</span>
                <button onClick={handleReprocess} className="text-[10px] text-[#6366f1] hover:underline ml-auto shrink-0">重试</button>
              </>
            )}
            {pageStatus === "done" && (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className="text-xs text-green-400">处理完成</span>
              </>
            )}
          </div>

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {/* Idle hints */}
            {pageStatus === "idle" && (
              <div className="p-4 text-xs text-[#a0a0b8] space-y-3">
                <div className="p-3 rounded-xl bg-gradient-to-br from-[#252540] to-[#1e1b4b] border border-[#3a3a5a]">
                  <p className="font-semibold text-sm text-[#f0f0f5] mb-2">AI 视频处理工作台</p>
                  <p className="leading-relaxed">选择视频文件开始。ClipWise 会自动分析并处理你的视频。</p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" />蓝色 = 有语音内容</div>
                  <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />红色 = 将被删除</div>
                  <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-400" />绿色 = 高光片段</div>
                </div>
              </div>
            )}

            {/* Processing progress — visible during processing, collapses to summary when done */}
            {(pageStatus === "processing" || pageStatus === "failed") && (
              <ProcessingPanel task={task} segments={segments} />
            )}
            {pageStatus === "done" && segments.length > 0 && (
              <div className="mx-4 mt-3 p-2.5 rounded-lg bg-[#252540] border border-[#3a3a5a] text-xs text-[#a0a0b8]">
                <div className="flex justify-between">
                  <span>检测到</span>
                  <span>{segments.filter((s) => s.type === "silence" || s.type === "filler").length} 段静音/填充词</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>已删除</span>
                  <span>{segments.filter((s) => s.type === "silence" || s.type === "filler").reduce((a, s) => a + (s.end - s.start), 0).toFixed(1)}s</span>
                </div>
              </div>
            )}

            {/* Re-export button */}
            {pageStatus === "done" && editedSegments && (
              <div className="mx-4 mt-2">
                <Button
                  className="w-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] hover:from-[#5558e6] hover:to-[#7c4ff0] text-white text-xs"
                  onClick={handleReExport}
                >
                  重新导出 (已编辑 {editedSegments.filter(s => s.type === "keep" || s.type === "speech").length} 段保留)
                </Button>
              </div>
            )}

            {/* Error message */}
            {pageStatus === "failed" && (
              <div className="mx-4 mt-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
                {task?.error || "处理失败"}
              </div>
            )}

            {/* Results — appears when done, never replaces processing info */}
            {pageStatus === "done" && taskResult && taskId && (
              <ResultPanel
                taskId={taskId}
                result={taskResult}
                onReprocess={handleReprocess}
              />
            )}
          </div>

          {/* Log terminal — always at bottom, visible once started */}
          {pageStatus !== "idle" && (
            <div className="shrink-0 h-[200px] border-t border-[#3a3a5a] p-3 pt-2">
              <LogTerminal logs={localLogs} />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default Home;
