"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TaskCardProps {
  id: string;
  filename: string;
  mode: string;
  status: string;
  created_at: string;
  onDelete: (id: string) => void;
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr + "Z");
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "completed": return "default";
    case "failed": return "destructive";
    case "pending": return "outline";
    default: return "secondary";
  }
}

export function TaskCard({ id, filename, mode, status, created_at, onDelete }: TaskCardProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/tasks/${id}`}
        className="flex flex-1 items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/5"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{filename}</p>
          <p className="mt-1 text-xs text-muted-foreground">{timeAgo(created_at)}</p>
        </div>
        <div className="ml-4 flex items-center gap-2">
          <Badge variant="outline">{mode}</Badge>
          <Badge variant={statusVariant(status)}>{status}</Badge>
        </div>
      </Link>
      {confirming ? (
        <div className="flex gap-1">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onDelete(id)}
          >
            Yes
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirming(false)}
          >
            No
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => setConfirming(true)}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Button>
      )}
    </div>
  );
}
