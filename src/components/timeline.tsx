"use client";

import { useEffect, useRef, useState } from "react";
import { TimelineTrack } from "./timeline-track";
import type { TimelineSegment, TimelineClip } from "@/lib/schema";

interface TimelineProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  duration: number;
  segments: TimelineSegment[];
  clips: TimelineClip[];
}

export function Timeline({ videoRef, duration, segments, clips }: TimelineProps) {
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

  if (duration <= 0) return null;

  return (
    <div className="border-t bg-card p-4">
      <TimelineTrack
        duration={duration}
        segments={segments}
        clips={clips}
        currentTime={currentTime}
        onSeek={handleSeek}
      />
    </div>
  );
}
