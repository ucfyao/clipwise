"""Transcribe video using mlx-whisper (Apple GPU accelerated). Outputs JSON-lines progress to stdout."""
import json
import sys
import os
import time
import threading

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
    file_size_mb = os.path.getsize(video_path) / (1024 * 1024)

    progress("loading_model", 5, message=f"加载模型 {model_size} (MLX GPU)...")
    progress("transcribing", 8, message=f"文件大小: {file_size_mb:.1f}MB")

    try:
        # Heartbeat thread — sends progress ticks while transcribing
        # so the UI doesn't look frozen
        transcribing = True
        start_time = time.time()

        def heartbeat():
            tick = 10
            while transcribing:
                elapsed = time.time() - start_time
                # Slowly increment from 10% to 85% over time
                pct = min(10 + int(elapsed * 2), 85)
                progress("transcribing", pct, message=f"GPU 转录中... ({elapsed:.0f}s)")
                time.sleep(3)

        hb_thread = threading.Thread(target=heartbeat, daemon=True)
        hb_thread.start()

        progress("transcribing", 10, message="开始 GPU 转录...")

        result = mlx_whisper.transcribe(
            video_path,
            path_or_hf_repo=model_id,
            word_timestamps=True,
            language=None,
        )

        transcribing = False
        elapsed = time.time() - start_time
        progress("transcribing", 88, message=f"转录完成 ({elapsed:.1f}s)，处理结果...")

        output = {
            "language": result.get("language", "unknown"),
            "duration": 0,
            "segments": [],
        }

        total_segments = len(result.get("segments", []))
        progress("transcribing", 89, message=f"解析 {total_segments} 个语音段落...")

        for i, segment in enumerate(result.get("segments", [])):
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
        progress("transcribing", 95, message=f"语言: {detected_lang}, 时长: {duration:.0f}s, {total_segments} 段")

        progress("transcribing", 97, message="写入转录文件...")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)

        progress("transcribe_done", 100, message=f"转录完成! {total_segments} 段, 耗时 {elapsed:.1f}s")

    except Exception as e:
        progress("error", 0, error=f"Transcription failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
