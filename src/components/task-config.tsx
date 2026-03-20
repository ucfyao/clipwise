"use client";

import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface TaskConfig {
  silence_threshold: number;
  keep_fillers: boolean;
  subtitle_style: "default" | "large-center";
  burn_subtitles: boolean;
}

type TaskMode = "clean" | "highlights" | "both";

interface TaskConfigProps {
  mode: TaskMode;
  setMode: (mode: TaskMode) => void;
  config: TaskConfig;
  setConfig: (config: TaskConfig) => void;
}

const modes: { value: TaskMode; label: string; desc: string }[] = [
  { value: "clean", label: "清理", desc: "去除静音和口误" },
  { value: "highlights", label: "精华", desc: "提取短视频片段" },
  { value: "both", label: "全部", desc: "清理 + 提取短视频" },
];

export function TaskConfigPanel({ mode, setMode, config, setConfig }: TaskConfigProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full space-y-4">
      {/* Mode selector */}
      <div className="grid grid-cols-3 gap-3">
        {modes.map((m) => (
          <button
            key={m.value}
            onClick={() => setMode(m.value)}
            className={cn(
              "rounded-lg border p-3 text-left transition-colors",
              mode === m.value
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50"
            )}
          >
            <p className="text-sm font-medium">{m.label}</p>
            <p className="text-xs text-muted-foreground">{m.desc}</p>
          </button>
        ))}
      </div>

      {/* Advanced settings toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <svg
          className={cn("h-4 w-4 transition-transform", open && "rotate-90")}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        高级设置
      </button>

      {open && (
        <div className="space-y-4 rounded-lg border border-border bg-card p-4">
          <div className="space-y-2">
            <Label>静音阈值：{config.silence_threshold}s</Label>
            <Slider
              value={[config.silence_threshold]}
              onValueChange={([v]) => setConfig({ ...config, silence_threshold: v })}
              min={1}
              max={10}
              step={0.5}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>保留口误</Label>
            <Switch
              checked={config.keep_fillers}
              onCheckedChange={(v) => setConfig({ ...config, keep_fillers: v })}
            />
          </div>

          <div className="space-y-2">
            <Label>字幕样式</Label>
            <Select
              value={config.subtitle_style}
              onValueChange={(v) => setConfig({ ...config, subtitle_style: v as "default" | "large-center" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">默认</SelectItem>
                <SelectItem value="large-center">大字居中</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label>烧录字幕</Label>
            <Switch
              checked={config.burn_subtitles}
              onCheckedChange={(v) => setConfig({ ...config, burn_subtitles: v })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
