"use client";

import { useState, useRef, useCallback } from "react";
import { Upload } from "lucide-react";

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
        <div className="w-16 h-16 rounded-full border-4 border-[#252540] border-t-[#6366f1] animate-spin" />
        <div className="text-[#a0a0b8] text-sm">读取中... {loadProgress}%</div>
        <div className="w-56 h-1.5 bg-[#252540] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#6366f1] to-[#a855f7] rounded-full transition-all duration-300"
            style={{ width: `${loadProgress}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center w-full max-w-lg mx-auto border-3 border-dashed rounded-2xl cursor-pointer transition-all duration-300 py-20 px-8 ${
        isDragging
          ? "border-[#6366f1] bg-[#6366f1]/10 scale-[1.02]"
          : "border-[#3a3a5a] bg-[#1a1a2e] hover:border-[#6366f1]/50 hover:bg-[#6366f1]/5"
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
      <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-5 transition-all ${
        isDragging ? "bg-[#6366f1] shadow-lg shadow-purple-500/30" : "bg-[#252540]"
      }`}>
        <Upload className={`w-10 h-10 transition-colors ${isDragging ? "text-white" : "text-[#a0a0b8]"}`} />
      </div>
      <p className="text-lg text-[#f0f0f5] font-medium mb-2">点击或拖拽视频文件到这里</p>
      <p className="text-sm text-[#a0a0b8]/70">
        支持 MP4, MOV, MKV, WebM, AVI · 最大 2GB
      </p>
    </div>
  );
}
