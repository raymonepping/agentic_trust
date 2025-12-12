#!/usr/bin/env bash
set -euo pipefail

# Small helper to refresh Role ID and Secret ID for a Vault AppRole
# and write them to a local .secret.env file next to this script.
#
# Usage:
#   ./refresh_approle_secrets.sh              # uses default role "agentic-trust"
#   ./refresh_approle_secrets.sh my-role-name # custom role name

ROLE_NAME="${1:-agentic-trust}"

RED=$'\e[31m'
GREEN=$'\e[32m'
YELLOW=$'\e[33m'
BLUE=$'\e[34m'
BOLD=$'\e[1m'
RESET=$'\e[0m'

info()  { printf '%sInfo:%s %s\n'   "$GREEN" "$RESET" "$*"; }
warn()  { printf '%sWarning:%s %s\n' "$YELLOW" "$RESET" "$*\n" >&2; }
error() { printf '%sError:%s %s\n'  "$RED" "$RESET" "$*\n" >&2; exit 1; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    error "Required command '$1' not found in PATH"
  fi
}

print_header() {
  printf '%s%sVault AppRole helper%s\n\n' "$BLUE" "$BOLD" "$RESET"
}

main() {
  print_header
  require_cmd vault

  # Basic sanity checks for Vault environment
  if [[ -z "${VAULT_ADDR:-}" ]]; then
    warn "VAULT_ADDR is not set. Using whatever default the vault CLI is configured with."
  fi
  if [[ -z "${VAULT_TOKEN:-}" ]]; then
    warn "VAULT_TOKEN is not set as an env var. The vault CLI may still work if you are logged in already."
  fi

  info "Using AppRole name: ${ROLE_NAME}"

  # Resolve script directory so we can place .secret.env next to it
  local script_dir out_file
  script_dir="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  out_file="${script_dir}/.secret.env"

  info "Reading current Role ID from Vault..."
  local role_id
  if ! role_id=$(vault read -field=role_id "auth/approle/role/${ROLE_NAME}/role-id"); then
    error "Failed to read Role ID from auth/approle/role/${ROLE_NAME}/role-id"
  fi

  info "Generating new Secret ID for role '${ROLE_NAME}'..."
  local secret_id
  if ! secret_id=$(vault write -f -field=secret_id "auth/approle/role/${ROLE_NAME}/secret-id"); then
    error "Failed to create Secret ID at auth/approle/role/${ROLE_NAME}/secret-id"
  fi

  # Write to .secret.env without printing sensitive values
  info "Writing VAULT_ROLE_ID and VAULT_SECRET_ID to ${out_file}"

  cat > "${out_file}" <<EOF
# Generated $(date -Iseconds) for AppRole '${ROLE_NAME}'
VAULT_ROLE_ID=${role_id}
VAULT_SECRET_ID=${secret_id}
EOF

  chmod 600 "${out_file}" || warn "Could not set 600 permissions on ${out_file}"

  info "Done. Values written to .secret.env next to this script."
  warn "Treat ${out_file} as sensitive. Add it to .gitignore if it is not already ignored."
}

main "$@"