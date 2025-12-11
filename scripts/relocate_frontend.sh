#!/usr/bin/env bash
set -euo pipefail

#############################################
# relocate_frontend.sh
#
# Usage:
#   ./relocate_frontend.sh <source_dir> <destination_dir>
#
# Example:
#   ./relocate_frontend.sh agentic_trust_frontend agentic_trust/frontend
#
# Both paths can be relative to the current directory.
#############################################

info()  { printf '[INFO] %s\n' "$*"; }
warn()  { printf '[WARN] %s\n' "$*" >&2; }
error() { printf '[ERROR] %s\n' "$*" >&2; exit 1; }

if [[ $# -ne 2 ]]; then
  cat <<EOF
Usage:
  $0 <source_dir> <destination_dir>

Example:
  $0 agentic_trust_frontend agentic_trust/frontend

Both paths can be relative to the current directory.
EOF
  exit 1
fi

SRC_RAW=$1
DEST_RAW=$2

# Resolve absolute paths where possible
if command -v realpath >/dev/null 2>&1; then
  SRC_DIR=$(realpath "$SRC_RAW")
  DEST_DIR=$(realpath "$DEST_RAW" 2>/dev/null || true)
else
  # Fallback: use simple resolution
  SRC_DIR=$(cd "$SRC_RAW" >/dev/null 2>&1 && pwd) \
    || error "Source directory '$SRC_RAW' does not exist"
  if [[ -d "$DEST_RAW" ]]; then
    DEST_DIR=$(cd "$DEST_RAW" >/dev/null 2>&1 && pwd)
  else
    DEST_DIR=""
  fi
fi

# Basic validation
[[ -d "$SRC_DIR" ]] || error "Source directory does not exist: $SRC_RAW"

# If destination dir is not yet there, create it
if [[ -z "${DEST_DIR:-}" ]]; then
  DEST_PARENT=$(dirname "$DEST_RAW")
  if [[ ! -d "$DEST_PARENT" ]]; then
    error "Destination parent does not exist: $DEST_PARENT"
  fi
  info "Creating destination directory: $DEST_RAW"
  mkdir -p "$DEST_RAW"
  if command -v realpath >/dev/null 2>&1; then
    DEST_DIR=$(realpath "$DEST_RAW")
  else
    DEST_DIR=$(cd "$DEST_RAW" >/dev/null 2>&1 && pwd)
  fi
fi

info "Source      : $SRC_DIR"
info "Destination : $DEST_DIR"

if [[ "$SRC_DIR" == "$DEST_DIR" ]]; then
  error "Source and destination resolve to the same directory. Nothing to do."
fi

#############################################
# Guardrail: check for running processes
#############################################

info "Checking for running processes that reference the source directory..."

if pgrep -af "$SRC_DIR" >/dev/null 2>&1; then
  warn "Detected running processes that reference: $SRC_DIR"
  warn "Please stop Nuxt or Node servers that use this folder before moving."
  warn "Example: stop 'npm run dev', 'nuxt dev', or 'node app.js' for this path."
  error "Aborting to avoid moving files under an active dev server."
fi

info "No matching running processes found. Proceeding."

#############################################
# Light verification of source structure
#############################################

if [[ ! -f "$SRC_DIR/package.json" ]]; then
  warn "No package.json found in source. This does not look like a Node or Nuxt project."
else
  info "Found package.json in source."
  if grep -qi "nuxt" "$SRC_DIR/package.json"; then
    info "Detected Nuxt related entry in package.json."
  else
    warn "No explicit 'nuxt' string found in package.json. Still continuing."
  fi
fi

#############################################
# Sync using rsync
#############################################

if ! command -v rsync >/dev/null 2>&1; then
  error "rsync is required but not installed. Please install rsync and retry."
fi

info "Syncing source into destination using rsync (excluding node_modules, build artefacts and .git)..."

rsync -av \
  --exclude=node_modules \
  --exclude=.nuxt \
  --exclude=.output \
  --exclude=.git \
  --exclude=.github \  
  --exclude=".idea" \
  --exclude=".vscode" \
  "$SRC_DIR"/ \
  "$DEST_DIR"/

info "Rsync completed."

#############################################
# Post sync verification
#############################################

VERIFY_ERRORS=0

# 1. Check for package.json in destination
if [[ -f "$DEST_DIR/package.json" ]]; then
  info "Verified: package.json present in destination."
else
  warn "Verification: package.json missing in destination."
  VERIFY_ERRORS=$((VERIFY_ERRORS + 1))
fi

# 2. Check for at least one of common Nuxt folders
if [[ -d "$DEST_DIR/app" || -d "$DEST_DIR/pages" || -d "$DEST_DIR/components" ]]; then
  info "Verified: Nuxt like folders found (app/pages/components)."
else
  warn "Verification: no app/pages/components folder found in destination."
  VERIFY_ERRORS=$((VERIFY_ERRORS + 1))
fi

# 3. Show a small tree like overview if tree exists
if command -v tree >/dev/null 2>&1; then
  info "Destination folder overview (top 2 levels):"
  tree -L 2 "$DEST_DIR"
else
  info "Tip: install 'tree' for a nicer overview of the destination structure."
fi

#############################################
# Summary
#############################################

if [[ $VERIFY_ERRORS -eq 0 ]]; then
  info "Frontend relocation completed without verification issues."
else
  warn "Frontend relocation completed with $VERIFY_ERRORS verification warning(s). Review the log above."
fi

cat <<EOF

Next steps:
  1. Change into the new frontend directory:
       cd "$DEST_DIR"

  2. Install dependencies (if not already done):
       npm install

  3. Start the frontend dev server:
       npm run dev

  4. Start or restart your backend in its usual location.

When you are satisfied everything works from the new location, you can optionally remove the old source folder:
  rm -rf "$SRC_DIR"
EOF
