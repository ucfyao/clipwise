"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TimelineTrack } from "./timeline-track";
import type { TimelineSegment, TimelineClip } from "@/lib/schema";

interface TimelineProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  duration: number;
  segments: TimelineSegment[];
  clips: TimelineClip[];
  waveformUrl?: string | null;
  editable?: boolean;
  onSegmentsChange?: (segments: TimelineSegment[]) => void;
}

export function Timeline({ videoRef, duration, segments, clips, waveformUrl, editable, onSegmentsChange }: TimelineProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const tick = () => {
      if (videoRef.current) {
        setCurrentTime(videoRef.current.currentTime);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [videoRef]);

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const handleToggle = useCallback((index: number) => {
    const updated = [...segments];
    const seg = updated[index];
    updated[index] = {
      ...seg,
      type: seg.type === "keep" || seg.type === "speech" ? "silence" : "keep",
    };
    onSegmentsChange?.(updated);
  }, [segments, onSegmentsChange]);

  const handleResize = useCallback((index: number, edge: "start" | "end", newTime: number) => {
    const updated = [...segments];
    const seg = updated[index];
    if (edge === "start") {
      const minTime = index > 0 ? updated[index - 1].start : 0;
      const clampedTime = Math.max(minTime, Math.min(newTime, seg.end - 0.1));
      if (index > 0) updated[index - 1] = { ...updated[index - 1], end: clampedTime };
      updated[index] = { ...seg, start: clampedTime };
    } else {
      const maxTime = index < updated.length - 1 ? updated[index + 1].end : duration;
      const clampedTime = Math.min(maxTime, Math.max(newTime, seg.start + 0.1));
      if (index < updated.length - 1) updated[index + 1] = { ...updated[index + 1], start: clampedTime };
      updated[index] = { ...seg, end: clampedTime };
    }
    onSegmentsChange?.(updated);
  }, [segments, duration, onSegmentsChange]);

  const handleSplit = useCallback((index: number, splitTime: number) => {
    const seg = segments[index];
    if (splitTime <= seg.start + 0.1 || splitTime >= seg.end - 0.1) return;
    const updated = [...segments];
    updated.splice(index, 1,
      { ...seg, end: splitTime },
      { ...seg, start: splitTime },
    );
    onSegmentsChange?.(updated);
  }, [segments, onSegmentsChange]);

  if (duration <= 0) return null;

  return (
    <div className="border-t bg-card p-4">
      {editable && (
        <div className="flex items-center gap-3 mb-2 text-[10px] text-muted-foreground">
          <span>点击切换类型</span>
          <span>拖拽边缘调整</span>
          <span>右键分割</span>
        </div>
      )}
      <TimelineTrack
        duration={duration}
        segments={segments}
        clips={clips}
        currentTime={currentTime}
        onSeek={handleSeek}
        waveformUrl={waveformUrl}
        editable={editable}
        onSegmentToggle={handleToggle}
        onSegmentResize={handleResize}
        onSegmentSplit={handleSplit}
      />
    </div>
  );
}
