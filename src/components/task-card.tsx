import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface TaskCardProps {
  id: string;
  filename: string;
  mode: string;
  status: string;
  created_at: string;
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

export function TaskCard({ id, filename, mode, status, created_at }: TaskCardProps) {
  return (
    <Link
      href={`/tasks/${id}`}
      className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/5"
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
  );
}
