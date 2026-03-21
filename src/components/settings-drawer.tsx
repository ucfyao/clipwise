"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export function SettingsDrawer() {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<"gemini" | "claude">("gemini");
  const [geminiKey, setGeminiKey] = useState("");
  const [claudeKey, setClaudeKey] = useState("");
  const [maskedGemini, setMaskedGemini] = useState("");
  const [maskedClaude, setMaskedClaude] = useState("");
  const [whisperModel, setWhisperModel] = useState("large-v3");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        setProvider(data.ai_provider || "gemini");
        setMaskedGemini(data.gemini_api_key || "");
        setMaskedClaude(data.anthropic_api_key || "");
        setWhisperModel(data.whisper_model || "large-v3");
      });
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    const body: Record<string, string> = {
      ai_provider: provider,
      whisper_model: whisperModel,
    };
    if (geminiKey) body.gemini_api_key = geminiKey;
    if (claudeKey) body.anthropic_api_key = claudeKey;

    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);
    toast.success("设置已保存");
    if (geminiKey) {
      setMaskedGemini(geminiKey.slice(0, 8) + "..." + geminiKey.slice(-4));
      setGeminiKey("");
    }
    if (claudeKey) {
      setMaskedClaude(claudeKey.slice(0, 8) + "..." + claudeKey.slice(-4));
      setClaudeKey("");
    }
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        title="设置"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setOpen(false)} />

          {/* Drawer */}
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm border-l border-border bg-background p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">设置</h2>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-6 space-y-6">
              {/* AI Provider */}
              <div className="space-y-2">
                <Label>AI 服务商</Label>
                <Select value={provider} onValueChange={(v) => setProvider(v as "gemini" | "claude")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini">Gemini（免费）</SelectItem>
                    <SelectItem value="claude">Claude（付费）</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Gemini API Key */}
              {provider === "gemini" && (
                <div className="space-y-2">
                  <Label>Gemini API Key</Label>
                  {maskedGemini && (
                    <p className="text-xs text-muted-foreground">当前: {maskedGemini}</p>
                  )}
                  <input
                    type="password"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder={maskedGemini ? "输入新 Key 替换" : "AIza..."}
                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    免费：<a href="https://ai.google.dev" target="_blank" rel="noopener" className="text-primary hover:underline">ai.google.dev</a>
                  </p>
                </div>
              )}

              {/* Claude API Key */}
              {provider === "claude" && (
                <div className="space-y-2">
                  <Label>Anthropic API Key</Label>
                  {maskedClaude && (
                    <p className="text-xs text-muted-foreground">当前: {maskedClaude}</p>
                  )}
                  <input
                    type="password"
                    value={claudeKey}
                    onChange={(e) => setClaudeKey(e.target.value)}
                    placeholder={maskedClaude ? "输入新 Key 替换" : "sk-ant-..."}
                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              )}

              {/* Whisper Model */}
              <div className="space-y-2">
                <Label>语音识别模型</Label>
                <Select value={whisperModel} onValueChange={setWhisperModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="base">Base（快速）</SelectItem>
                    <SelectItem value="medium">Medium（平衡）</SelectItem>
                    <SelectItem value="large-v3">Large V3（最准确）</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? "保存中..." : "保存"}
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
