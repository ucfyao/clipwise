"use client";

import { Button } from "@/components/ui/button";
import { ClipCard } from "@/components/clip-card";
import { CopyPanel } from "@/components/copy-panel";
import { Download, FolderOpen, RotateCcw } from "lucide-react";
import type { TaskResult } from "@/lib/schema";

interface ResultPanelProps {
  taskId: string;
  result: TaskResult;
  onReprocess: () => void;
}

export function ResultPanel({ taskId, result, onReprocess }: ResultPanelProps) {
  const downloadUrl = (type: string) => `/api/tasks/${taskId}/download?type=${type}`;

  const openInFinder = async () => {
    await fetch(`/api/tasks/${taskId}/open`, { method: "POST" });
  };

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
      <div className="text-sm font-medium text-green-500">处理完成</div>

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

      <div className="mt-auto space-y-2 pt-4">
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
