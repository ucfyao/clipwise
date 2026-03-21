"use client";

import { useMemo } from "react";
import type { TimelineSegment, TimelineClip } from "@/lib/schema";

interface TimelineTrackProps {
  duration: number;
  segments: TimelineSegment[];
  clips: TimelineClip[];
  currentTime: number;
  onSeek: (time: number) => void;
}

const SEGMENT_COLORS: Record<TimelineSegment["type"], string> = {
  speech: "bg-blue-500/70",
  keep: "bg-blue-500/70",
  silence: "bg-red-500/50",
  filler: "bg-orange-500/50",
};

export function TimelineTrack({ duration, segments, clips, currentTime, onSeek }: TimelineTrackProps) {
  const rulers = useMemo(() => {
    if (duration <= 0) return [];
    const count = Math.min(Math.ceil(duration / 30), 10);
    const interval = duration / count;
    return Array.from({ length: count + 1 }, (_, i) => {
      const t = interval * i;
      const m = Math.floor(t / 60);
      const s = Math.floor(t % 60);
      return { time: t, label: `${m}:${s.toString().padStart(2, "0")}` };
    });
  }, [duration]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    onSeek(pct * duration);
  };

  const playheadPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="select-none">
      <div className="flex justify-between px-1 mb-1">
        {rulers.map((r) => (
          <span key={r.time} className="text-[10px] text-muted-foreground">{r.label}</span>
        ))}
      </div>

      <div
        className="relative h-10 bg-muted rounded-lg cursor-pointer overflow-hidden"
        onClick={handleClick}
      >
        {segments.map((seg, i) => {
          const left = (seg.start / duration) * 100;
          const width = ((seg.end - seg.start) / duration) * 100;
          return (
            <div
              key={i}
              className={`absolute top-0 h-full ${SEGMENT_COLORS[seg.type]} transition-all`}
              style={{ left: `${left}%`, width: `${Math.max(width, 0.2)}%` }}
              title={seg.reason || seg.type}
            />
          );
        })}

        {clips.map((clip, i) => {
          const left = (clip.start / duration) * 100;
          const width = ((clip.end - clip.start) / duration) * 100;
          return (
            <div
              key={`clip-${i}`}
              className="absolute top-0 h-full border-2 border-green-400 rounded-sm pointer-events-none"
              style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%` }}
              title={`${clip.title} (${clip.score})`}
            />
          );
        })}

        <div
          className="absolute top-0 h-full w-0.5 bg-red-500 z-10 pointer-events-none"
          style={{ left: `${playheadPct}%` }}
        >
          <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-red-500 rounded-full" />
        </div>
      </div>
    </div>
  );
}
