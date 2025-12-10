#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3001}"
INTERVAL="${INTERVAL:-10}"   # seconds
WATCH="false"

usage() {
  cat <<EOF
Usage: $(basename "$0") [--watch] [--interval N]

Options:
  --watch, -w       Continuously poll the endpoints until Ctrl+C
  --interval, -i N  Interval in seconds between polls (default: ${INTERVAL})
  --help, -h        Show this help

Env:
  BASE_URL   Base URL for the backend (default: ${BASE_URL})
  INTERVAL   Default interval for --watch (seconds)

Examples:
  $(basename "$0")
  $(basename "$0") --watch
  $(basename "$0") --watch --interval 5
EOF
}

# Simple tool checks
if ! command -v curl >/dev/null 2>&1; then
  echo "Error: curl is required but not found in PATH" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required but not found in PATH" >&2
  exit 1
fi

# Parse flags
while [[ $# -gt 0 ]]; do
  case "$1" in
    --watch|-w)
      WATCH="true"
      shift
      ;;
    --interval|-i)
      shift
      if [[ $# -eq 0 ]]; then
        echo "Error: --interval requires a value" >&2
        exit 1
      fi
      INTERVAL="$1"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Error: unknown option: $1" >&2
      echo
      usage
      exit 1
      ;;
  esac
done

print_once() {
  echo "▶ Health"
  command curl -s "${BASE_URL}/health" | jq
  echo

  echo "▶ DB lease"
  command curl -s "${BASE_URL}/db/lease" | jq
  echo

  echo "▶ DB diagnostics"
  command curl -s "${BASE_URL}/db/diagnostics" | jq
  echo
}

if [[ "${WATCH}" == "false" ]]; then
  # Single run, current behavior
  print_once
  exit 0
fi

# Watch mode
echo "Watching ${BASE_URL} every ${INTERVAL}s. Press Ctrl+C to stop."
echo

while true; do
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') ==="
  print_once
  sleep "${INTERVAL}"
done
