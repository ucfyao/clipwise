"""Transcribe video using mlx-whisper (Apple GPU accelerated) with real progress."""
import json
import sys
import os
import time

import mlx_whisper
import mlx_whisper.transcribe as _transcribe_module


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
    file_size_mb = os.path.getsize(video_path) / (1024 * 1024)

    progress("loading_model", 5, message=f"加载模型 {model_size} (MLX GPU)...")
    progress("transcribing", 8, message=f"文件大小: {file_size_mb:.1f}MB")

    try:
        # Monkey-patch tqdm in mlx_whisper to get real progress
        start_time = time.time()

        class ProgressTqdm:
            """Fake tqdm that reports real progress via our callback."""
            def __init__(self, *args, **kwargs):
                self.total = kwargs.get("total", 0)
                self.n = 0
                progress("transcribing", 10, message="开始 GPU 转录...")

            def update(self, n):
                self.n += n
                if self.total > 0:
                    pct = min(int((self.n / self.total) * 80) + 10, 90)
                    elapsed = time.time() - start_time
                    remaining = (elapsed / max(self.n, 1)) * (self.total - self.n)
                    progress("transcribing", pct, message=f"GPU 转录中... {pct}% (剩余 {remaining:.0f}s)")

            def __enter__(self):
                return self

            def __exit__(self, *args):
                pass

        # Patch tqdm in the transcribe module
        import tqdm as _tqdm_module
        original_tqdm = _tqdm_module.tqdm
        _tqdm_module.tqdm = ProgressTqdm
        # Also patch it in mlx_whisper's transcribe module if it imported tqdm directly
        if hasattr(_transcribe_module, "tqdm"):
            _original_transcribe_tqdm = _transcribe_module.tqdm
            _transcribe_module.tqdm = type("FakeTqdmModule", (), {"tqdm": ProgressTqdm})()

        result = mlx_whisper.transcribe(
            video_path,
            path_or_hf_repo=model_id,
            word_timestamps=True,
            language=None,
            verbose=False,  # This enables tqdm (our patched version)
        )

        # Restore tqdm
        _tqdm_module.tqdm = original_tqdm
        if hasattr(_transcribe_module, "tqdm"):
            _transcribe_module.tqdm = _original_transcribe_tqdm

        elapsed = time.time() - start_time
        progress("transcribing", 92, message=f"转录完成 ({elapsed:.1f}s)，处理结果...")

        output = {
            "language": result.get("language", "unknown"),
            "duration": 0,
            "segments": [],
        }

        total_segments = len(result.get("segments", []))
        progress("transcribing", 94, message=f"解析 {total_segments} 个语音段落...")

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

        detected_lang = output["language"]
        duration = output["duration"]
        progress("transcribing", 97, message=f"语言: {detected_lang}, 时长: {duration:.0f}s, {total_segments} 段")

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)

        progress("transcribe_done", 100, message=f"转录完成! {total_segments} 段, 耗时 {elapsed:.1f}s")

    except Exception as e:
        progress("error", 0, error=f"Transcription failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
