"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";

interface ClipCardProps {
  title: string;
  duration: number;
  score: number;
  downloadUrl: string;
  previewUrl: string;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ClipCard({ title, duration, score, downloadUrl, previewUrl }: ClipCardProps) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/30">
      {/* Video preview area */}
      <div className="relative aspect-video bg-black">
        {playing ? (
          <video
            src={previewUrl}
            controls
            autoPlay
            className="h-full w-full"
            onEnded={() => setPlaying(false)}
          />
        ) : (
          <button
            onClick={() => setPlaying(true)}
            className="flex h-full w-full items-center justify-center transition-opacity hover:opacity-80"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur">
              <svg className="ml-1 h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </button>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="text-sm font-medium line-clamp-2">{title}</h3>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex gap-2">
            <Badge variant="secondary">{formatDuration(duration)}</Badge>
            <Badge variant="outline">Score: {score}</Badge>
          </div>
          <a
            href={downloadUrl}
            download
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
