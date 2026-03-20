"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface PlatformCopy {
  platform: string;
  title: string;
  description: string;
  hashtags: string[];
}

interface ClipCopy {
  clip_title: string;
  platforms: PlatformCopy[];
}

const platformLabels: Record<string, string> = {
  douyin: "抖音",
  xiaohongshu: "小红书",
  youtube_shorts: "YouTube Shorts",
};

function CopyButton({ text }: { text: string }) {
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        toast.success("已复制到剪贴板");
      }}
      className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
      title="复制"
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    </button>
  );
}

export function CopyPanel({ copies }: { copies: ClipCopy[] }) {
  const [expandedClip, setExpandedClip] = useState<number | null>(null);

  if (!copies.length) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">发布文案</h2>
      <div className="space-y-3">
        {copies.map((clip, i) => (
          <div key={i} className="rounded-lg border border-border bg-card">
            <button
              onClick={() => setExpandedClip(expandedClip === i ? null : i)}
              className="flex w-full items-center justify-between p-4 text-left"
            >
              <span className="text-sm font-medium">{clip.clip_title}</span>
              <svg
                className={`h-4 w-4 text-muted-foreground transition-transform ${expandedClip === i ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {expandedClip === i && (
              <div className="border-t border-border p-4 space-y-4">
                {clip.platforms.map((p) => (
                  <div key={p.platform} className="space-y-2">
                    <Badge variant="outline">{platformLabels[p.platform] || p.platform}</Badge>
                    <div className="space-y-1 pl-2">
                      <div className="flex items-start">
                        <p className="text-sm font-medium flex-1">{p.title}</p>
                        <CopyButton text={p.title} />
                      </div>
                      <div className="flex items-start">
                        <p className="text-xs text-muted-foreground flex-1">{p.description}</p>
                        <CopyButton text={p.description} />
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        {p.hashtags.map((tag) => (
                          <span key={tag} className="text-xs text-primary">#{tag}</span>
                        ))}
                        <CopyButton text={p.hashtags.map(t => `#${t}`).join(" ")} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
