interface VideoPlayerProps {
  src: string;
  className?: string;
}

export function VideoPlayer({ src, className }: VideoPlayerProps) {
  return (
    <video
      controls
      className={`w-full rounded-lg bg-black ${className || ""}`}
      src={src}
    />
  );
}
