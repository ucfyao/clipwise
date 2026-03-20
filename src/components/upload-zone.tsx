"use client";

import { useState, useRef, useCallback } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

interface UploadResult {
  filename: string;
  filepath: string;
}

interface UploadZoneProps {
  onUpload: (result: UploadResult) => void;
  onDurationDetected?: (duration: number) => void;
  onPreviewReady?: (url: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function UploadZone({ onUpload, onDurationDetected, onPreviewReady }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number>(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const reset = useCallback(() => {
    setUploadedFile(null);
    setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    setDuration(null);
    setFileSize(0);
    setError(null);
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setError(null);

    if (!file.type.startsWith("video/")) {
      setError("请上传视频文件");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("文件过大（最大 2GB）");
      return;
    }

    setUploading(true);
    setProgress(0);
    setFileSize(file.size);

    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    onPreviewReady?.(url);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      const result = await new Promise<UploadResult>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status === 200) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(JSON.parse(xhr.responseText).error || "上传失败"));
          }
        };
        xhr.onerror = () => reject(new Error("网络错误"));
        xhr.open("POST", "/api/upload");
        xhr.send(formData);
      });

      setUploadedFile(result.filename);
      onUpload(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
      setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    } finally {
      setUploading(false);
    }
  }, [onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // After upload success — show preview + file info
  if (uploadedFile && previewUrl) {
    return (
      <div className="w-full space-y-3">
        <video
          ref={videoRef}
          src={previewUrl}
          controls
          className="w-full rounded-lg bg-black"
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration);
              onDurationDetected?.(videoRef.current.duration);
            }
          }}
        />
        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{uploadedFile}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatSize(fileSize)}
              {duration !== null && ` · ${formatDuration(duration)}`}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={reset}>
            更换
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && inputRef.current?.click()}
      className={cn(
        "flex min-h-[250px] w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors",
        isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
        uploading && "pointer-events-none opacity-70"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {uploading ? (
        <div className="flex w-full max-w-xs flex-col items-center gap-3">
          <p className="text-sm text-muted-foreground">上传中...</p>
          <Progress value={progress} className="w-full" />
          <p className="text-xs text-muted-foreground">{progress}%</p>
        </div>
      ) : (
        <>
          <svg className="mb-3 h-10 w-10 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm font-medium">拖拽视频到这里，或点击选择</p>
          <p className="mt-1 text-xs text-muted-foreground">MP4, MOV, MKV, WebM, AVI — 最大 2GB，90 分钟</p>
        </>
      )}

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </div>
  );
}
