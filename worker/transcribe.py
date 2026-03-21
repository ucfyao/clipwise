"""Transcribe video using mlx-whisper (Apple GPU accelerated). Outputs JSON-lines progress to stdout."""
import json
import sys
import os

import mlx_whisper


MODEL_MAP = {
    "tiny": "mlx-community/whisper-tiny-mlx",
    "base": "mlx-community/whisper-base-mlx-q4",
    "small": "mlx-community/whisper-small-mlx",
    "medium": "mlx-community/whisper-medium-mlx",
    "large-v3": "mlx-community/whisper-large-v3-mlx",
}


def progress(step: str, pct: int, **kwargs):
    print(json.dumps({"step": step, "progress": pct, **kwargs}), flush=True)


def main():
    video_path = sys.argv[1]
    output_path = sys.argv[2]
    model_size = sys.argv[3] if len(sys.argv) > 3 else "large-v3"

    if not os.path.isfile(video_path):
        progress("error", 0, error=f"File not found: {video_path}")
        sys.exit(1)

    model_id = MODEL_MAP.get(model_size, MODEL_MAP["large-v3"])

    try:
        progress("loading_model", 5, message=f"加载模型 {model_size} (MLX GPU)...")

        result = mlx_whisper.transcribe(
            video_path,
            path_or_hf_repo=model_id,
            word_timestamps=True,
            language=None,
        )

        progress("transcribing", 50, message="转录中...")

        output = {
            "language": result.get("language", "unknown"),
            "duration": 0,
            "segments": [],
        }

        for segment in result.get("segments", []):
            words = []
            if "words" in segment:
                words = [
                    {"word": w["word"], "start": w["start"], "end": w["end"], "probability": w.get("probability", 0.0)}
                    for w in segment["words"]
                ]

            output["segments"].append({
                "start": segment["start"],
                "end": segment["end"],
                "text": segment["text"].strip(),
                "words": words,
            })

            if segment["end"] > output["duration"]:
                output["duration"] = segment["end"]

        progress("transcribing", 90, message="写入结果...")

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)

        progress("transcribe_done", 100)

    except Exception as e:
        progress("error", 0, error=f"Transcription failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
