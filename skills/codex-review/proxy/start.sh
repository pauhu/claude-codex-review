#!/bin/bash
# Start both proxies for Codex → Claude Max
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Starting Claude Max proxy chain..."
echo ""

# 1. Start claude-max-api-proxy (port 3456)
echo "[1/2] Starting claude-max-api-proxy on port 3456..."
npx claude-max-api-proxy 3456 &
PROXY_PID=$!
sleep 2

# Check if it started
if ! kill -0 $PROXY_PID 2>/dev/null; then
  echo "ERROR: claude-max-api-proxy failed to start"
  echo "Make sure Claude Code CLI is installed and authenticated:"
  echo "  npm install -g @anthropic-ai/claude-code"
  echo "  claude auth login"
  exit 1
fi

# 2. Start responses adapter (port 4000 → 3456)
echo "[2/2] Starting responses adapter on port 4000..."
node "$SCRIPT_DIR/responses-adapter.js" &
ADAPTER_PID=$!
sleep 1

echo ""
echo "Ready. Codex will connect to http://localhost:4000"
echo ""
echo "Test with:"
echo '  curl http://localhost:4000/health'
echo ""
echo "Press Ctrl+C to stop both."

# Cleanup on exit
cleanup() {
  echo ""
  echo "Stopping..."
  kill $ADAPTER_PID 2>/dev/null || true
  kill $PROXY_PID 2>/dev/null || true
  exit 0
}

trap cleanup SIGINT SIGTERM
wait
