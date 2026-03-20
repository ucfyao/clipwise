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
  { value: "clean", label: "Clean", desc: "Remove silence & fillers" },
  { value: "highlights", label: "Highlights", desc: "Extract short clips" },
  { value: "both", label: "Both", desc: "Clean + extract clips" },
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
        Advanced Settings
      </button>

      {open && (
        <div className="space-y-4 rounded-lg border border-border bg-card p-4">
          <div className="space-y-2">
            <Label>Silence Threshold: {config.silence_threshold}s</Label>
            <Slider
              value={[config.silence_threshold]}
              onValueChange={([v]) => setConfig({ ...config, silence_threshold: v })}
              min={1}
              max={10}
              step={0.5}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Keep Fillers</Label>
            <Switch
              checked={config.keep_fillers}
              onCheckedChange={(v) => setConfig({ ...config, keep_fillers: v })}
            />
          </div>

          <div className="space-y-2">
            <Label>Subtitle Style</Label>
            <Select
              value={config.subtitle_style}
              onValueChange={(v) => setConfig({ ...config, subtitle_style: v as "default" | "large-center" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="large-center">Large Center</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label>Burn Subtitles</Label>
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
