"use client";

import { forwardRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface VideoPreviewProps {
  previewUrl: string;
  cleanedVideoUrl?: string;
}

export const VideoPreview = forwardRef<HTMLVideoElement, VideoPreviewProps>(
  function VideoPreview({ previewUrl, cleanedVideoUrl }, ref) {
    const [showCleaned, setShowCleaned] = useState(false);
    const currentUrl = showCleaned && cleanedVideoUrl ? cleanedVideoUrl : previewUrl;

    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center bg-black/50 rounded-xl overflow-hidden">
          <video
            ref={ref}
            src={currentUrl}
            controls
            className="max-w-full max-h-full"
          />
        </div>
        {cleanedVideoUrl && (
          <div className="flex gap-2 justify-center mt-3">
            <Button
              variant={!showCleaned ? "default" : "outline"}
              size="sm"
              onClick={() => setShowCleaned(false)}
            >
              原始视频
            </Button>
            <Button
              variant={showCleaned ? "default" : "outline"}
              size="sm"
              onClick={() => setShowCleaned(true)}
            >
              清理后
            </Button>
          </div>
        )}
      </div>
    );
  }
);
