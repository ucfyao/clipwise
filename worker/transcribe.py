"""Transcribe video using faster-whisper. Outputs JSON-lines progress to stdout."""
import json
import sys
import os

from faster_whisper import WhisperModel


def progress(step: str, pct: int, **kwargs):
    print(json.dumps({"step": step, "progress": pct, **kwargs}), flush=True)


def main():
    video_path = sys.argv[1]
    output_path = sys.argv[2]
    model_size = sys.argv[3] if len(sys.argv) > 3 else "large-v3"

    if not os.path.isfile(video_path):
        progress("error", 0, error=f"File not found: {video_path}")
        sys.exit(1)

    try:
        progress("loading_model", 5)
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
    except Exception as e:
        progress("error", 0, error=f"Failed to load model: {e}")
        sys.exit(1)

    try:
        progress("transcribing", 10)
        segments, info = model.transcribe(
            video_path,
            language=None,
            word_timestamps=True,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500),
        )

        result = {
            "language": info.language,
            "duration": info.duration,
            "segments": [],
        }

        total_duration = info.duration
        for segment in segments:
            pct = min(10 + int((segment.end / total_duration) * 80), 90) if total_duration > 0 else 50
            progress("transcribing", pct)

            words = []
            if segment.words:
                words = [
                    {"word": w.word, "start": w.start, "end": w.end, "probability": w.probability}
                    for w in segment.words
                ]

            result["segments"].append({
                "start": segment.start,
                "end": segment.end,
                "text": segment.text.strip(),
                "words": words,
            })

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)

        progress("transcribe_done", 100)

    except Exception as e:
        progress("error", 0, error=f"Transcription failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
