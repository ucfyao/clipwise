import { Badge } from "@/components/ui/badge";

interface ClipCardProps {
  title: string;
  duration: number;
  score: number;
  downloadUrl: string;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ClipCard({ title, duration, score, downloadUrl }: ClipCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/5">
      <div className="mb-3 flex aspect-video items-center justify-center rounded-md bg-black">
        <svg className="h-10 w-10 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 className="text-sm font-medium line-clamp-2">{title}</h3>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex gap-2">
          <Badge variant="secondary">{formatDuration(duration)}</Badge>
          <Badge variant="outline">Score: {score}</Badge>
        </div>
        <a
          href={downloadUrl}
          download
          className="inline-flex h-7 items-center justify-center gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] font-medium transition-all hover:bg-muted hover:text-foreground dark:hover:bg-muted/50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </a>
      </div>
    </div>
  );
}
