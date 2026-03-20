"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadZone } from "@/components/upload-zone";
import { TaskConfigPanel } from "@/components/task-config";
import { Button } from "@/components/ui/button";

interface TaskConfig {
  silence_threshold: number;
  keep_fillers: boolean;
  subtitle_style: "default" | "large-center";
  burn_subtitles: boolean;
}

const DEFAULT_CONFIG: TaskConfig = {
  silence_threshold: 3,
  keep_fillers: false,
  subtitle_style: "default",
  burn_subtitles: false,
};

export default function Home() {
  const router = useRouter();
  const [uploadResult, setUploadResult] = useState<{ filename: string; filepath: string } | null>(null);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [mode, setMode] = useState<"clean" | "highlights" | "both">("both");
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    if (!uploadResult) return;
    setLoading(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...uploadResult, mode, config }),
      });
      const { id } = await res.json();
      router.push(`/tasks/${id}`);
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">One-Click Video Editing</h1>
        <p className="mt-2 text-muted-foreground">
          Upload a teaching video, get it cleaned and clipped automatically.
        </p>
      </div>

      <div className="w-full max-w-2xl">
        <UploadZone onUpload={setUploadResult} />
      </div>

      {uploadResult && (
        <div className="w-full max-w-2xl space-y-6">
          <TaskConfigPanel mode={mode} setMode={setMode} config={config} setConfig={setConfig} />
          <div className="flex justify-center">
            <Button
              onClick={handleStart}
              disabled={loading}
              size="lg"
              className="px-8"
            >
              {loading ? "Starting..." : "Start Processing"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
