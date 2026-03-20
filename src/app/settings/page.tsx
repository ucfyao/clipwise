"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function SettingsPage() {
  const [provider, setProvider] = useState<"gemini" | "claude">("gemini");
  const [geminiKey, setGeminiKey] = useState("");
  const [claudeKey, setClaudeKey] = useState("");
  const [maskedGemini, setMaskedGemini] = useState("");
  const [maskedClaude, setMaskedClaude] = useState("");
  const [whisperModel, setWhisperModel] = useState("large-v3");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        setProvider(data.ai_provider || "gemini");
        setMaskedGemini(data.gemini_api_key || "");
        setMaskedClaude(data.anthropic_api_key || "");
        setWhisperModel(data.whisper_model || "large-v3");
      });
  }, []);

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
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">设置</h1>

      <div className="max-w-lg space-y-6">
        {/* AI Provider */}
        <div className="space-y-2">
          <Label>AI 服务商</Label>
          <Select value={provider} onValueChange={(v) => setProvider(v as "gemini" | "claude")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gemini">Google Gemini（免费）</SelectItem>
              <SelectItem value="claude">Anthropic Claude（付费，效果更好）</SelectItem>
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
              免费申请：<a href="https://ai.google.dev" target="_blank" rel="noopener" className="text-primary hover:underline">ai.google.dev</a> → 获取 API Key。每天 100 万 token 免费额度。
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
            <p className="text-xs text-muted-foreground">
              付费 API，效果更好。不填则使用基础模式（仅去静音）。
            </p>
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
              <SelectItem value="base">Base（快速，准确率一般）</SelectItem>
              <SelectItem value="medium">Medium（平衡）</SelectItem>
              <SelectItem value="large-v3">Large V3（最准确，较慢）</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? "保存中..." : "保存设置"}
        </Button>
      </div>
    </div>
  );
}
