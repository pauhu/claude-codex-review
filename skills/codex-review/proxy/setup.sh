#!/bin/bash
# One-time setup: configure Codex CLI to use Claude Max via proxy
set -eu

CODEX_CONFIG="$HOME/.codex/config.toml"
mkdir -p "$HOME/.codex"

# Back up existing config
if [ -f "$CODEX_CONFIG" ]; then
  cp "$CODEX_CONFIG" "$CODEX_CONFIG.bak"
  echo "Backed up existing config to $CODEX_CONFIG.bak"
fi

cat > "$CODEX_CONFIG" << 'EOF'
model = "claude-sonnet-4"
model_provider = "claude-max"

[model_providers.claude-max]
name = "Claude Max via proxy"
base_url = "http://localhost:4000/v1"
env_key = "CODEX_API_KEY"
wire_api = "responses"

[sandbox]
mode = "read-only"

[otel]
exporter = "none"
EOF

# Set a dummy API key (proxy doesn't check it)
export CODEX_API_KEY="sk-claude-max"
echo 'export CODEX_API_KEY="sk-claude-max"' >> "$HOME/.bashrc"

echo "Done. Codex configured for Claude Max."
echo ""
echo "Next steps:"
echo "  1. Start the proxy:  bash proxy/start.sh"
echo "  2. Use Codex:        codex 'hello'"
echo "  3. Or as MCP server: claude mcp add codex -s user -- codex mcp-server"
