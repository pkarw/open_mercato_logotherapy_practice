#!/bin/sh
set -eu
marker=".cache/openmercato-agentic-prepared"
if [ -f "$marker" ]; then
  exit 0
fi
mercato agentic:init --tool=claude-code,codex --force
mkdir -p "$(dirname "$marker")"
: > "$marker"
