"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ClipCard } from "@/components/clip-card";
import { CopyPanel } from "@/components/copy-panel";
import { Download, FolderOpen, RotateCcw, Image, Film, Music, FileDown } from "lucide-react";
import type { TaskResult } from "@/lib/schema";

interface ResultPanelProps {
  taskId: string;
  result: TaskResult;
  onReprocess: () => void;
}

export function ResultPanel({ taskId, result, onReprocess }: ResultPanelProps) {
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportResults, setExportResults] = useState<Record<string, { filename: string; downloadUrl: string }>>({});
  const [thumbnailTime, setThumbnailTime] = useState("");
  const [gifStart, setGifStart] = useState(0);
  const [gifDuration, setGifDuration] = useState(5);
  const [audioFormat, setAudioFormat] = useState<"mp3" | "aac">("mp3");
  const [compressQuality, setCompressQuality] = useState<"high" | "medium" | "low">("medium");

  const downloadUrl = (type: string) => `/api/tasks/${taskId}/download?type=${type}`;

  const handleExport = async (tool: string, options: Record<string, unknown>) => {
    setExporting(tool);
    try {
      const res = await fetch(`/api/tasks/${taskId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool, options }),
      });
      if (!res.ok) throw new Error("Export failed");
      const data = await res.json();
      setExportResults((prev) => ({ ...prev, [tool]: data }));
    } catch {
      // Could add error toast here
    } finally {
      setExporting(null);
    }
  };

  const openInFinder = async () => {
    await fetch(`/api/tasks/${taskId}/open`, { method: "POST" });
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="space-y-2">
        {result.cleaned_video && (
          <a href={downloadUrl("cleaned")} className="flex items-center justify-between p-2.5 border rounded-lg hover:bg-muted/50 transition-colors">
            <div>
              <span className="text-sm">去静音后的视频</span>
              <span className="text-[10px] text-muted-foreground block">已去除静音和填充词段落</span>
            </div>
            <Download className="w-4 h-4 text-muted-foreground shrink-0" />
          </a>
        )}
        {result.srt_file && (
          <a href={downloadUrl("srt")} className="flex items-center justify-between p-2.5 border rounded-lg hover:bg-muted/50 transition-colors">
            <div>
              <span className="text-sm">纯文本字幕</span>
              <span className="text-[10px] text-muted-foreground block">SRT 格式，兼容所有播放器</span>
            </div>
            <Download className="w-4 h-4 text-muted-foreground shrink-0" />
          </a>
        )}
        {result.subtitle_file && (
          <a href={downloadUrl("subtitle")} className="flex items-center justify-between p-2.5 border rounded-lg hover:bg-muted/50 transition-colors">
            <div>
              <span className="text-sm">动画字幕</span>
              <span className="text-[10px] text-muted-foreground block">逐字高亮效果，适合短视频</span>
            </div>
            <Download className="w-4 h-4 text-muted-foreground shrink-0" />
          </a>
        )}
      </div>

      {result.clips && result.clips.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">高光片段</h4>
          <div className="space-y-2">
            {result.clips.map((clip, i) => (
              <ClipCard
                key={i}
                title={clip.title}
                duration={clip.duration}
                score={clip.score}
                downloadUrl={`/api/tasks/${taskId}/download?type=clip&index=${i}`}
                previewUrl={`/api/tasks/${taskId}/download?type=clip&index=${i}`}
              />
            ))}
          </div>
        </div>
      )}

      {result.copy && result.copy.length > 0 && (
        <CopyPanel copies={result.copy} />
      )}

      {/* 导出工具 */}
      <div>
        <h4 className="text-sm font-medium mb-2">导出工具</h4>
        <div className="space-y-2">
          {/* 提取封面 */}
          <div className="p-2.5 border rounded-lg">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Image className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm">提取封面</span>
            </div>
            <p className="text-[10px] text-muted-foreground mb-2">从视频中截取一帧作为封面图</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="自动"
                value={thumbnailTime}
                onChange={(e) => setThumbnailTime(e.target.value)}
                className="w-16 bg-muted border rounded px-2 py-1 text-xs"
              />
              <span className="text-[10px] text-muted-foreground">秒</span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={exporting === "thumbnail"}
                onClick={() => handleExport("thumbnail", { time: thumbnailTime ? Number(thumbnailTime) : undefined })}
              >
                {exporting === "thumbnail" ? "处理中..." : "提取"}
              </Button>
              {exportResults.thumbnail && (
                <a href={exportResults.thumbnail.downloadUrl} className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <Download className="w-3.5 h-3.5" />
                  <span>JPG</span>
                </a>
              )}
            </div>
          </div>

          {/* 生成 GIF */}
          <div className="p-2.5 border rounded-lg">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Film className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm">生成 GIF</span>
            </div>
            <p className="text-[10px] text-muted-foreground mb-2">将视频片段转为 GIF 动图</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={gifStart}
                onChange={(e) => setGifStart(Number(e.target.value))}
                className="w-14 bg-muted border rounded px-2 py-1 text-xs"
              />
              <span className="text-[10px] text-muted-foreground">秒起</span>
              <input
                type="number"
                value={gifDuration}
                max={10}
                onChange={(e) => setGifDuration(Number(e.target.value))}
                className="w-14 bg-muted border rounded px-2 py-1 text-xs"
              />
              <span className="text-[10px] text-muted-foreground">秒长</span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={exporting === "gif"}
                onClick={() => handleExport("gif", { start: gifStart, duration: gifDuration })}
              >
                {exporting === "gif" ? "处理中..." : "生成"}
              </Button>
              {exportResults.gif && (
                <a href={exportResults.gif.downloadUrl} className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <Download className="w-3.5 h-3.5" />
                  <span>GIF</span>
                </a>
              )}
            </div>
          </div>

          {/* 提取音频 */}
          <div className="p-2.5 border rounded-lg">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Music className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm">提取音频</span>
            </div>
            <p className="text-[10px] text-muted-foreground mb-2">从视频中提取音频轨道</p>
            <div className="flex items-center gap-2">
              <select
                value={audioFormat}
                onChange={(e) => setAudioFormat(e.target.value as "mp3" | "aac")}
                className="bg-muted border rounded px-2 py-1 text-xs"
              >
                <option value="mp3">MP3</option>
                <option value="aac">AAC</option>
              </select>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={exporting === "audio"}
                onClick={() => handleExport("audio", { format: audioFormat })}
              >
                {exporting === "audio" ? "处理中..." : "提取"}
              </Button>
              {exportResults.audio && (
                <a href={exportResults.audio.downloadUrl} className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <Download className="w-3.5 h-3.5" />
                  <span>{exportResults.audio.filename}</span>
                </a>
              )}
            </div>
          </div>

          {/* 视频压缩 */}
          <div className="p-2.5 border rounded-lg">
            <div className="flex items-center gap-1.5 mb-1.5">
              <FileDown className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm">视频压缩</span>
            </div>
            <p className="text-[10px] text-muted-foreground mb-2">压缩视频文件体积</p>
            <div className="flex items-center gap-2">
              <select
                value={compressQuality}
                onChange={(e) => setCompressQuality(e.target.value as "high" | "medium" | "low")}
                className="bg-muted border rounded px-2 py-1 text-xs"
              >
                <option value="high">高质量</option>
                <option value="medium">中等</option>
                <option value="low">低质量</option>
              </select>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={exporting === "compress"}
                onClick={() => handleExport("compress", { quality: compressQuality })}
              >
                {exporting === "compress" ? "处理中..." : "压缩"}
              </Button>
              {exportResults.compress && (
                <a href={exportResults.compress.downloadUrl} className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <Download className="w-3.5 h-3.5" />
                  <span>{exportResults.compress.filename}</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2 pt-2">
        <a href={downloadUrl("all")} className="block">
          <Button variant="outline" className="w-full">
            <Download className="w-4 h-4 mr-2" />
            保存全部
          </Button>
        </a>
        <Button variant="outline" className="w-full" onClick={openInFinder}>
          <FolderOpen className="w-4 h-4 mr-2" />
          在 Finder 中打开
        </Button>
        <Button variant="ghost" className="w-full" onClick={onReprocess}>
          <RotateCcw className="w-4 h-4 mr-2" />
          重新处理
        </Button>
      </div>
    </div>
  );
}
