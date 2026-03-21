"use client";

import { useState, useRef, useCallback } from "react";
import { FolderOpen } from "lucide-react";

interface FilePickerProps {
  onFileReady: (data: { filename: string; filepath: string; previewUrl: string; duration: number }) => void;
}

export function FilePicker({ onFileReady }: FilePickerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("video/")) return;
      if (file.size > 2 * 1024 * 1024 * 1024) return;

      setIsLoading(true);
      const previewUrl = URL.createObjectURL(file);

      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        const duration = video.duration;

        const formData = new FormData();
        formData.append("file", file);

        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setLoadProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status === 200) {
            const { filename, filepath } = JSON.parse(xhr.responseText);
            onFileReady({ filename, filepath, previewUrl, duration });
          }
          setIsLoading(false);
        };
        xhr.onerror = () => setIsLoading(false);
        xhr.open("POST", "/api/upload");
        xhr.send(formData);
      };
      video.src = previewUrl;
    },
    [onFileReady]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-muted-foreground">读取中... {loadProgress}%</div>
        <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${loadProgress}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center h-full border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
        isDragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
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
      <FolderOpen className="w-16 h-16 text-muted-foreground mb-4" />
      <p className="text-lg text-muted-foreground">选择视频文件</p>
      <p className="text-sm text-muted-foreground/60 mt-2">
        点击或拖拽 · MP4, MOV, MKV, WebM, AVI · 最大 2GB
      </p>
    </div>
  );
}
