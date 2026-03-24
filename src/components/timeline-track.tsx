"use client";

import { useMemo } from "react";
import type { TimelineSegment, TimelineClip } from "@/lib/schema";

interface TimelineTrackProps {
  duration: number;
  segments: TimelineSegment[];
  clips: TimelineClip[];
  currentTime: number;
  onSeek: (time: number) => void;
  waveformUrl?: string | null;
  editable?: boolean;
  onSegmentToggle?: (index: number) => void;
  onSegmentResize?: (index: number, edge: "start" | "end", newTime: number) => void;
  onSegmentSplit?: (index: number, splitTime: number) => void;
}

const SEGMENT_COLORS: Record<TimelineSegment["type"], string> = {
  speech: "bg-blue-500/70",
  keep: "bg-blue-500/70",
  silence: "bg-red-500/50",
  filler: "bg-orange-500/50",
};

export function TimelineTrack({
  duration, segments, clips, currentTime, onSeek, waveformUrl,
  editable, onSegmentToggle, onSegmentResize, onSegmentSplit,
}: TimelineTrackProps) {
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

  const handleDragStart = (e: React.MouseEvent, segIndex: number, edge: "start" | "end") => {
    if (!onSegmentResize) return;
    e.preventDefault();
    e.stopPropagation();
    const container = (e.currentTarget as HTMLElement).closest(".timeline-track-container") as HTMLElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const onMove = (moveEvent: MouseEvent) => {
      const pct = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width));
      const newTime = Math.round(pct * duration * 100) / 100;
      onSegmentResize(segIndex, edge, newTime);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
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
        className="timeline-track-container relative h-10 bg-muted rounded-lg cursor-pointer overflow-hidden"
        onClick={handleClick}
      >
        {waveformUrl && (
          <img
            src={waveformUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none"
          />
        )}
        {segments.map((seg, i) => {
          const left = (seg.start / duration) * 100;
          const width = ((seg.end - seg.start) / duration) * 100;
          return (
            <div
              key={i}
              className={`absolute top-0 h-full ${SEGMENT_COLORS[seg.type]} transition-all ${
                editable ? "cursor-pointer hover:brightness-125" : ""
              }`}
              style={{ left: `${left}%`, width: `${Math.max(width, 0.2)}%` }}
              title={seg.reason || seg.type}
              onClick={(e) => {
                if (!editable || !onSegmentToggle) return;
                e.stopPropagation();
                onSegmentToggle(i);
              }}
              onContextMenu={(e) => {
                if (!editable || !onSegmentSplit) return;
                e.preventDefault();
                e.stopPropagation();
                const rect = e.currentTarget.parentElement!.getBoundingClientRect();
                const pct = (e.clientX - rect.left) / rect.width;
                onSegmentSplit(i, pct * duration);
              }}
            >
              {editable && (
                <>
                  <div
                    className="absolute left-0 top-0 w-1.5 h-full cursor-col-resize bg-white/30 hover:bg-white/60 z-20"
                    onMouseDown={(e) => handleDragStart(e, i, "start")}
                  />
                  <div
                    className="absolute right-0 top-0 w-1.5 h-full cursor-col-resize bg-white/30 hover:bg-white/60 z-20"
                    onMouseDown={(e) => handleDragStart(e, i, "end")}
                  />
                </>
              )}
            </div>
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
