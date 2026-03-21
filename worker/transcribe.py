"""Transcribe video using faster-whisper. Outputs JSON-lines progress to stdout."""
import json
import sys
import os
import threading
import time

from faster_whisper import WhisperModel
from huggingface_hub import scan_cache_dir


MODEL_REPO_MAP = {
    "tiny": "Systran/faster-whisper-tiny",
    "base": "Systran/faster-whisper-base",
    "small": "Systran/faster-whisper-small",
    "medium": "Systran/faster-whisper-medium",
    "large-v3": "Systran/faster-whisper-large-v3",
}

# Approximate model sizes in bytes for download progress
MODEL_SIZES = {
    "tiny": 75_000_000,
    "base": 150_000_000,
    "small": 500_000_000,
    "medium": 1_500_000_000,
    "large-v3": 3_100_000_000,
}


def progress(step: str, pct: int, **kwargs):
    print(json.dumps({"step": step, "progress": pct, **kwargs}), flush=True)


def is_model_cached(model_size: str) -> bool:
    """Check if model is already downloaded."""
    repo_id = MODEL_REPO_MAP.get(model_size, f"Systran/faster-whisper-{model_size}")
    try:
        cache_info = scan_cache_dir()
        for repo in cache_info.repos:
            if repo.repo_id == repo_id:
                return repo.size_on_disk > MODEL_SIZES.get(model_size, 0) * 0.9
    except Exception:
        pass
    return False


def get_cache_size(model_size: str) -> int:
    """Get current cached size for the model."""
    repo_id = MODEL_REPO_MAP.get(model_size, f"Systran/faster-whisper-{model_size}")
    cache_dir = os.path.expanduser("~/.cache/huggingface/hub")
    model_dir = os.path.join(cache_dir, f"models--{repo_id.replace('/', '--')}")
    if not os.path.exists(model_dir):
        return 0
    total = 0
    for dirpath, _, filenames in os.walk(model_dir):
        for f in filenames:
            total += os.path.getsize(os.path.join(dirpath, f))
    return total


def main():
    video_path = sys.argv[1]
    output_path = sys.argv[2]
    model_size = sys.argv[3] if len(sys.argv) > 3 else "large-v3"

    if not os.path.isfile(video_path):
        progress("error", 0, error=f"File not found: {video_path}")
        sys.exit(1)

    try:
        cached = is_model_cached(model_size)
        if cached:
            progress("loading_model", 5, message=f"加载模型 {model_size}...")
        else:
            expected = MODEL_SIZES.get(model_size, 0)
            size_mb = expected // (1024 * 1024)
            progress("downloading_model", 1, message=f"首次使用，正在下载模型 {model_size}（约 {size_mb}MB）...")

            # Monitor download progress in background
            stop_monitor = threading.Event()
            def monitor_download():
                while not stop_monitor.is_set():
                    current = get_cache_size(model_size)
                    if expected > 0:
                        pct = min(int((current / expected) * 100), 99)
                        current_mb = current // (1024 * 1024)
                        progress("downloading_model", pct, message=f"下载模型中... {current_mb}MB / {size_mb}MB")
                    time.sleep(3)

            monitor_thread = threading.Thread(target=monitor_download, daemon=True)
            monitor_thread.start()

        model = WhisperModel(model_size, device="cpu", compute_type="int8")

        if not cached:
            stop_monitor.set()
            progress("downloading_model", 100, message="模型下载完成")

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
