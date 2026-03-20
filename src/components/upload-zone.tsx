"use client";

import { useState, useRef, useCallback } from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

interface UploadResult {
  filename: string;
  filepath: string;
}

interface UploadZoneProps {
  onUpload: (result: UploadResult) => void;
}

export function UploadZone({ onUpload }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);

    if (!file.type.startsWith("video/")) {
      setError("Please upload a video file");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("File too large (max 2GB)");
      return;
    }

    setUploading(true);
    setProgress(0);

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
            reject(new Error(JSON.parse(xhr.responseText).error || "Upload failed"));
          }
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.open("POST", "/api/upload");
        xhr.send(formData);
      });

      setUploadedFile(result.filename);
      onUpload(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
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

      {uploadedFile ? (
        <div className="flex items-center gap-2 text-green-500">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-medium">{uploadedFile}</span>
        </div>
      ) : uploading ? (
        <div className="flex w-full max-w-xs flex-col items-center gap-3">
          <p className="text-sm text-muted-foreground">Uploading...</p>
          <Progress value={progress} className="w-full" />
          <p className="text-xs text-muted-foreground">{progress}%</p>
        </div>
      ) : (
        <>
          <svg className="mb-3 h-10 w-10 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm font-medium">Drop video here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">MP4, MOV, MKV, WebM, AVI — Max 2GB, 90 minutes</p>
        </>
      )}

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </div>
  );
}
