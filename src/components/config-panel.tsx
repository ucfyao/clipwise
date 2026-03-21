"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TaskConfig, TaskMode } from "@/lib/schema";

interface ConfigPanelProps {
  videoInfo: { resolution: string; duration: number; size: string };
  onStart: (mode: TaskMode, config: TaskConfig) => void;
}

export function ConfigPanel({ videoInfo, onStart }: ConfigPanelProps) {
  const [mode, setMode] = useState<TaskMode>("both");
  const [silenceThreshold, setSilenceThreshold] = useState(3);
  const [keepFillers, setKeepFillers] = useState(false);
  const [subtitleStyle, setSubtitleStyle] = useState<"default" | "large-center">("default");
  const [burnSubtitles, setBurnSubtitles] = useState(false);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col gap-6 p-4 overflow-y-auto h-full">
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">视频信息</h3>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">分辨率</span>
            <span>{videoInfo.resolution}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">时长</span>
            <span>{formatDuration(videoInfo.duration)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">大小</span>
            <span>{videoInfo.size}</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">处理模式</h3>
        <div className="grid grid-cols-3 gap-2">
          {(["clean", "highlights", "both"] as TaskMode[]).map((m) => (
            <Button
              key={m}
              variant={mode === m ? "default" : "outline"}
              size="sm"
              onClick={() => setMode(m)}
            >
              {m === "clean" ? "清理" : m === "highlights" ? "高光" : "两者"}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">参数</h3>

        <div>
          <div className="flex justify-between mb-2">
            <Label className="text-sm">静音阈值</Label>
            <span className="text-sm text-muted-foreground">{silenceThreshold}s</span>
          </div>
          <Slider
            value={[silenceThreshold]}
            onValueChange={([v]) => setSilenceThreshold(v)}
            min={0.5}
            max={10}
            step={0.5}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-sm">保留填充词</Label>
          <Switch checked={keepFillers} onCheckedChange={setKeepFillers} />
        </div>

        <div>
          <Label className="text-sm">字幕样式</Label>
          <Select value={subtitleStyle} onValueChange={(v) => setSubtitleStyle(v as typeof subtitleStyle)}>
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">默认 (18px)</SelectItem>
              <SelectItem value="large-center">大号居中 (24px)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-sm">烧录字幕</Label>
          <Switch checked={burnSubtitles} onCheckedChange={setBurnSubtitles} />
        </div>
      </div>

      <Button
        className="w-full mt-auto"
        size="lg"
        onClick={() =>
          onStart(mode, {
            silence_threshold: silenceThreshold,
            keep_fillers: keepFillers,
            subtitle_style: subtitleStyle,
            burn_subtitles: burnSubtitles,
          })
        }
      >
        开始处理
      </Button>
    </div>
  );
}
