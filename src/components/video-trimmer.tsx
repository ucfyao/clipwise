"use client";

import { useState, useRef, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface VideoTrimmerProps {
  videoUrl: string;
  duration: number;
  onTrimChange: (trim: { enabled: boolean; start: number; end: number }) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function parseTime(str: string): number {
  const parts = str.split(":");
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }
  return 0;
}

export function VideoTrimmer({ videoUrl, duration, onTrimChange }: VideoTrimmerProps) {
  const [enabled, setEnabled] = useState(false);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(Math.floor(duration));
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setEnd(Math.floor(duration));
  }, [duration]);

  useEffect(() => {
    onTrimChange({ enabled, start, end });
  }, [enabled, start, end, onTrimChange]);

  const handleStartChange = (value: string) => {
    const t = parseTime(value);
    if (t >= 0 && t < end) {
      setStart(t);
      if (videoRef.current) videoRef.current.currentTime = t;
    }
  };

  const handleEndChange = (value: string) => {
    const t = parseTime(value);
    if (t > start && t <= Math.floor(duration)) {
      setEnd(t);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">裁剪视频范围</Label>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      {enabled && (
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">从</span>
              <input
                type="text"
                value={formatTime(start)}
                onChange={(e) => handleStartChange(e.target.value)}
                className="w-16 rounded border border-border bg-background px-2 py-1 text-center text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">到</span>
              <input
                type="text"
                value={formatTime(end)}
                onChange={(e) => handleEndChange(e.target.value)}
                className="w-16 rounded border border-border bg-background px-2 py-1 text-center text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <span className="text-xs text-muted-foreground">
              共 {formatTime(end - start)}
            </span>
          </div>

          {/* Visual timeline bar */}
          <div className="relative h-2 w-full rounded-full bg-muted">
            <div
              className="absolute h-full rounded-full bg-primary"
              style={{
                left: `${(start / duration) * 100}%`,
                width: `${((end - start) / duration) * 100}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
