#!/usr/bin/env bash
# Aider launcher with OpenRouter API Key

export PATH="$HOME/Library/Python/3.9/bin:$PATH"

if [ -z "$OPENROUTER_API_KEY" ]; then
  DEV_VARS="$(dirname "$0")/../worker/.dev.vars"
  if [ -f "$DEV_VARS" ]; then
    KEY=$(grep -E '^OPENROUTER_KEY=' "$DEV_VARS" | cut -d '=' -f2- | tr -d '"' | tr -d "'")
    if [ -n "$KEY" ]; then
      export OPENROUTER_API_KEY="$KEY"
    fi
  fi
fi

if [ -z "$OPENROUTER_API_KEY" ]; then
  echo "Error: OPENROUTER_API_KEY not set and not found in worker/.dev.vars"
  exit 1
fi

exec aider "$@"
