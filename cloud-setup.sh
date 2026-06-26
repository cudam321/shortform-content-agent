#!/usr/bin/env bash
# Cloud environment setup for Claude Code Routines (cached between runs).
# Installs: ffmpeg, whisper.cpp (whisper-cli), the whisper model, node deps, Remotion's browser.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

if ! command -v ffmpeg >/dev/null; then
  # PPA-tolerant: third-party PPAs 403 inside the sandbox; main repos are reachable
  (sudo apt-get update -y 2>/dev/null || apt-get update -y 2>/dev/null || true)
  (sudo apt-get install -y ffmpeg cmake build-essential git curl) \
    || (apt-get install -y ffmpeg cmake build-essential git curl)
fi

if ! command -v whisper-cli >/dev/null; then
  git clone --depth 1 https://github.com/ggml-org/whisper.cpp /tmp/whisper.cpp
  # GGML_NATIVE=OFF is CRITICAL: the build CPU advertises Intel AMX, so -march=native
  # bakes in AMX matrix kernels — but the run sandbox doesn't enable AMX tile registers,
  # so any AMX instruction SIGILLs ("AMX is not ready to be used!", exit 132). Compile a
  # portable AVX2/FMA/F16C binary instead — runs everywhere, plenty fast for small.en.
  cmake -S /tmp/whisper.cpp -B /tmp/whisper.cpp/build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF \
    -DGGML_NATIVE=OFF -DGGML_AVX=ON -DGGML_AVX2=ON -DGGML_FMA=ON -DGGML_F16C=ON
  cmake --build /tmp/whisper.cpp/build -j"$(nproc)" --target whisper-cli
  sudo cp /tmp/whisper.cpp/build/bin/whisper-cli /usr/local/bin/ 2>/dev/null \
    || cp /tmp/whisper.cpp/build/bin/whisper-cli /usr/local/bin/
  rm -rf /tmp/whisper.cpp
fi

npm ci
npx remotion browser ensure || true

mkdir -p models
if [ ! -f models/ggml-small.en.bin ]; then
  # Requires ggml.ggerganov.com (and/or cas-bridge.xethub.hf.co) in the environment's network allowlist
  curl -sL --fail -o models/ggml-small.en.bin "https://ggml.ggerganov.com/ggml-model-whisper-small.en.bin" \
    || curl -sL --fail -o models/ggml-small.en.bin "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin" \
    || echo "WARNING: whisper model unavailable - transcription will be skipped (check network allowlist)"
fi
# Smoke-test the ACTUAL transcription path — `whisper-cli --help` passing is not enough,
# an AMX-built binary only SIGILLs once it touches real matrix work.
if [ -f models/ggml-small.en.bin ]; then
  ffmpeg -y -f lavfi -i "sine=frequency=440:duration=2" -ar 16000 /tmp/amx-test.wav 2>/dev/null
  if whisper-cli -m models/ggml-small.en.bin -f /tmp/amx-test.wav -nt >/dev/null 2>&1; then
    echo "whisper-cli transcription smoke-test: OK"
  else
    echo "FATAL: whisper-cli built but transcription crashed (exit $?) — likely AMX/ISA mismatch, fix build flags"
  fi
fi
echo "cloud setup complete: ffmpeg=$(ffmpeg -version | head -1 | cut -d' ' -f3), whisper=$(command -v whisper-cli), model=$(ls -la models/ | grep small | awk '{print $5}')"
