"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadZone } from "@/components/upload-zone";
import { TaskConfigPanel } from "@/components/task-config";
import { VideoTrimmer } from "@/components/video-trimmer";
import { Button } from "@/components/ui/button";

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


export default function Home() {
  const router = useRouter();
  const [uploadResult, setUploadResult] = useState<{ filename: string; filepath: string } | null>(null);
  const [config, setConfig] = useState<TaskConfig>(DEFAULT_CONFIG);
  const [mode, setMode] = useState<"clean" | "highlights" | "both">("both");
  const [loading, setLoading] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [trim, setTrim] = useState({ enabled: false, start: 0, end: 0 });

  const handleStart = async () => {
    if (!uploadResult) return;
    setLoading(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...uploadResult, mode, config, trim: trim.enabled ? { start: trim.start, end: trim.end } : undefined }),
      });
      const { id } = await res.json();
      router.push(`/tasks/${id}`);
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">一键视频剪辑</h1>
        <p className="mt-2 text-muted-foreground">
          上传教学视频，自动清理并生成短视频
        </p>
      </div>

      <div className="w-full max-w-2xl">
        <UploadZone
          onUpload={setUploadResult}
          onDurationDetected={setVideoDuration}
          onPreviewReady={setPreviewUrl}
        />
      </div>

      {uploadResult && (
        <div className="w-full max-w-2xl space-y-6">
          {previewUrl && videoDuration > 0 && (
            <VideoTrimmer
              videoUrl={previewUrl}
              duration={videoDuration}
              onTrimChange={setTrim}
            />
          )}
          <TaskConfigPanel mode={mode} setMode={setMode} config={config} setConfig={setConfig} />
          <div className="flex justify-center">
            <Button
              onClick={handleStart}
              disabled={loading}
              size="lg"
              className="px-8"
            >
              {loading ? "处理中..." : "开始处理"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
