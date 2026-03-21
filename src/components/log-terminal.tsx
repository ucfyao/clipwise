"use client";

import { useEffect, useRef } from "react";
import type { LogEntry } from "@/hooks/use-task-sse";

interface LogTerminalProps {
  logs: LogEntry[];
}

const LEVEL_COLORS: Record<string, string> = {
  info: "text-[#22c55e]",
  warn: "text-[#eab308]",
  error: "text-[#ef4444]",
};

export function LogTerminal({ logs }: LogTerminalProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  return (
    <div className="h-full flex flex-col bg-[#0a0a14] rounded-lg border border-[#3a3a5a] overflow-hidden">
      {/* Terminal header */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a2e] border-b border-[#3a3a5a]">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#eab308]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" />
        </div>
        <span className="text-[10px] text-[#a0a0b8] font-mono ml-2">clipwise — processing log</span>
      </div>

      {/* Log content */}
      <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-[1.6] space-y-0.5">
        {logs.length === 0 && (
          <div className="text-[#3a3a5a]">等待日志...</div>
        )}
        {logs.map((log, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-[#3a3a5a] shrink-0 select-none">{log.message.slice(1, 13)}</span>
            <span className={`${LEVEL_COLORS[log.level] || LEVEL_COLORS.info}`}>
              {log.message.slice(14)}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
