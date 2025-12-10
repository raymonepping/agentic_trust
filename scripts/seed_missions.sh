#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3001}"
DATA_FILE="${1:-missions_seed.json}"

if ! command -v jq >/dev/null 2>&1; then
  echo "❌ jq is required but not found. Install via: brew install jq"
  exit 1
fi

if [[ ! -f "$DATA_FILE" ]]; then
  echo "❌ Data file not found: $DATA_FILE"
  exit 1
fi

echo "🚀 Seeding missions into ${API_BASE}/missions from ${DATA_FILE}"
echo

idx=0
jq -c '.[]' "$DATA_FILE" | while IFS= read -r mission; do
  idx=$((idx + 1))
  title=$(echo "$mission" | jq -r '.title')

  echo "▶ Mission ${idx}: ${title}"

  # Post the mission JSON as is
  http_code=$(curl -sS -o /tmp/mission_resp.json -w "%{http_code}" \
    -X POST "${API_BASE}/missions" \
    -H "Content-Type: application/json" \
    -d "$mission" || echo "000")

  if [[ "$http_code" == "201" || "$http_code" == "200" ]]; then
    id=$(jq -r '.id // "unknown-id"' /tmp/mission_resp.json 2>/dev/null || echo "unknown-id")
    echo "   ✅ Created (HTTP ${http_code}), id=${id}"
  else
    echo "   ❌ Failed (HTTP ${http_code})"
    echo "   Response:"
    sed 's/^/     /' /tmp/mission_resp.json
  fi

  echo
done

echo "✅ Seeding completed."
