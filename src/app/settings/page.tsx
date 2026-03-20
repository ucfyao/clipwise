"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [maskedKey, setMaskedKey] = useState("");
  const [whisperModel, setWhisperModel] = useState("large-v3");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        setMaskedKey(data.anthropic_api_key || "");
        setWhisperModel(data.whisper_model || "large-v3");
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const body: Record<string, string> = { whisper_model: whisperModel };
    if (apiKey) body.anthropic_api_key = apiKey;

    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);
    toast.success("设置已保存");
    if (apiKey) {
      setMaskedKey(apiKey.slice(0, 10) + "..." + apiKey.slice(-4));
      setApiKey("");
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">设置</h1>

      <div className="max-w-lg space-y-6">
        {/* API Key */}
        <div className="space-y-2">
          <Label>Anthropic API Key</Label>
          {maskedKey && (
            <p className="text-xs text-muted-foreground">当前: {maskedKey}</p>
          )}
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={maskedKey ? "输入新 Key 替换" : "sk-ant-..."}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          <p className="text-xs text-muted-foreground">
            用于 AI 内容分析和精华提取。不填则使用基础模式（仅去静音）。
          </p>
        </div>

        {/* Whisper Model */}
        <div className="space-y-2">
          <Label>语音识别模型</Label>
          <Select value={whisperModel} onValueChange={setWhisperModel}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="base">Base (快速，准确率一般)</SelectItem>
              <SelectItem value="medium">Medium (平衡)</SelectItem>
              <SelectItem value="large-v3">Large V3 (最准确，较慢)</SelectItem>
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
