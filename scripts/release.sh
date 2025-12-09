#!/usr/bin/env bash
set -euo pipefail

VERSION_FILE="VERSION"

RED=$'\e[31m'
GREEN=$'\e[32m'
YELLOW=$'\e[33m'
BLUE=$'\e[34m'
BOLD=$'\e[1m'
RESET=$'\e[0m'

# These will be set in ensure_git_repo
PROJECT_ROOT=""
REPO_ROOT=""
PROJECT_REL_PATH=""

print_header() {
  echo "${BLUE}${BOLD}agentic_trust release script${RESET}"
  echo
}

usage() {
  cat <<EOF
Usage: $(basename "$0") [--patch|--minor|--major] [--dry-run] [--init-remote] [--help]

Options:
  --patch        Bump patch version (X.Y.Z -> X.Y.(Z+1))
  --minor        Bump minor version (X.Y.Z -> X.(Y+1).0)
  --major        Bump major version (X.Y.Z -> (X+1).0.0)
  --dry-run      Show what would happen without making changes
  --init-remote  If no 'origin' remote exists, attempt to create one using GitHub CLI 'gh'
  --help         Show this help and exit

Examples:
  $(basename "$0") --patch
  $(basename "$0") --minor --init-remote
  $(basename "$0") --major --dry-run
EOF
}

error() {
  echo "${RED}Error:${RESET} $*" >&2
}

info() {
  echo "${GREEN}Info:${RESET} $*"
}

warn() {
  echo "${YELLOW}Warning:${RESET} $*"
}

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    error "Required command '$cmd' not found in PATH"
    exit 1
  fi
}

parse_args() {
  BUMP_TYPE=""
  DRY_RUN="false"
  INIT_REMOTE="false"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --patch)
        BUMP_TYPE="patch"
        ;;
      --minor)
        BUMP_TYPE="minor"
        ;;
      --major)
        BUMP_TYPE="major"
        ;;
      --dry-run)
        DRY_RUN="true"
        ;;
      --init-remote)
        INIT_REMOTE="true"
        ;;
      --help|-h)
        print_header
        usage
        exit 0
        ;;
      *)
        error "Unknown option: $1"
        echo
        usage
        exit 1
        ;;
    esac
    shift
  done

  if [[ -z "${BUMP_TYPE}" ]]; then
    error "You must specify one of: --patch, --minor, --major"
    echo
    usage
    exit 1
  fi
}

ensure_git_repo() {
  # Determine the directory where this script lives
  local script_dir
  script_dir="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

  # Project root is the parent of the scripts directory (agentic_trust)
  PROJECT_ROOT="$(cd "${script_dir}/.." && pwd)"

  # If project root is already inside a git repo, use that
  if git -C "${PROJECT_ROOT}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    REPO_ROOT="$(git -C "${PROJECT_ROOT}" rev-parse --show-toplevel)"

    if [[ "${PROJECT_ROOT}" == "${REPO_ROOT}" ]]; then
      PROJECT_REL_PATH="."
    else
      PROJECT_REL_PATH="${PROJECT_ROOT#${REPO_ROOT}/}"
    fi
  else
    # No git repo yet, initialize one in the project root
    warn "The project root '${PROJECT_ROOT}' is not inside a git repository. Initializing a new git repo there."
    cd "${PROJECT_ROOT}"
    git init >/dev/null
    REPO_ROOT="${PROJECT_ROOT}"
    PROJECT_REL_PATH="."
    info "Initialized new git repository at ${REPO_ROOT}"
  fi

  # Change directory to the repo root so all git commands run there
  cd "${REPO_ROOT}"

  info "Repository root: ${REPO_ROOT}"
  info "Project root:    ${PROJECT_ROOT}"
  info "Project path:    ${PROJECT_REL_PATH}"
  echo
}

read_version() {
  local version_path="${PROJECT_ROOT}/${VERSION_FILE}"

  if [[ ! -f "${version_path}" ]]; then
    warn "VERSION file not found in project root, creating one with 0.0.0"
    echo "0.0.0" > "${version_path}"
  fi

  local raw
  raw=$(<"${version_path}")

  if [[ ! "$raw" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
    error "VERSION '${raw}' is not valid semantic version (X.Y.Z)"
    exit 1
  fi

  CURRENT_MAJOR="${BASH_REMATCH[1]}"
  CURRENT_MINOR="${BASH_REMATCH[2]}"
  CURRENT_PATCH="${BASH_REMATCH[3]}"
  CURRENT_VERSION="${CURRENT_MAJOR}.${CURRENT_MINOR}.${CURRENT_PATCH}"
}

compute_new_version() {
  case "${BUMP_TYPE}" in
    patch)
      NEW_MAJOR="${CURRENT_MAJOR}"
      NEW_MINOR="${CURRENT_MINOR}"
      NEW_PATCH=$((CURRENT_PATCH + 1))
      ;;
    minor)
      NEW_MAJOR="${CURRENT_MAJOR}"
      NEW_MINOR=$((CURRENT_MINOR + 1))
      NEW_PATCH=0
      ;;
    major)
      NEW_MAJOR=$((CURRENT_MAJOR + 1))
      NEW_MINOR=0
      NEW_PATCH=0
      ;;
    *)
      error "Unknown bump type '${BUMP_TYPE}'"
      exit 1
      ;;
  esac

  NEW_VERSION="${NEW_MAJOR}.${NEW_MINOR}.${NEW_PATCH}"
}

ensure_clean_or_warn() {
  # Show git status only for the project path inside the repo
  local status
  status=$(git status --porcelain -- "${PROJECT_REL_PATH}")

  if [[ -n "$status" ]]; then
    warn "Working tree has changes under '${PROJECT_REL_PATH}'. These will be committed as part of this release."
    echo "$status"
    echo
  fi
}

update_version_file() {
  local version_path="${PROJECT_ROOT}/${VERSION_FILE}"
  echo "${NEW_VERSION}" > "${version_path}"
}

has_origin_remote() {
  git remote | grep -q '^origin$'
}

create_remote_if_requested() {
  if has_origin_remote; then
    return 0
  fi

  if [[ "${INIT_REMOTE}" != "true" ]]; then
    warn "No 'origin' remote found. Skipping push and remote tag sync."
    echo "You can set a remote manually with for example:"
    echo "  git remote add origin <url>"
    return 1
  fi

  if ! command -v gh >/dev/null 2>&1; then
    warn "No 'origin' remote and GitHub CLI 'gh' not found. Cannot auto create remote."
    echo "Please create a remote manually, then re run this script."
    return 1
  fi

  local repo_name
  repo_name="${GIT_REPO_NAME:-$(basename "${REPO_ROOT}")}"

  info "Creating GitHub repository '${repo_name}' via gh CLI and pushing current branch."

  if gh repo create "${repo_name}" --source "${REPO_ROOT}" --private --push; then
    info "GitHub repository '${repo_name}' created and initial push completed."
    return 0
  else
    warn "Failed to create and push GitHub repository via gh CLI."
    echo "You can create the remote manually and then re run this script."
    return 1
  fi
}

has_head() {
  git rev-parse --verify HEAD >/dev/null 2>&1
}

commit_and_tag() {
  local branch

  if has_head; then
    branch=$(git rev-parse --abbrev-ref HEAD)
  else
    # Fresh repo, no commits yet. Use 'main' as the logical branch name.
    branch="main"
  fi

  # Stage only the project path, not the entire repo
  git add -- "${PROJECT_REL_PATH}"

  # Decide whether there is anything to commit
  if has_head; then
    # Normal case: HEAD exists, we can safely use diff on the index
    if git diff --cached --quiet; then
      warn "No changes to commit for '${PROJECT_REL_PATH}'. Skipping commit and tag."
      return
    fi
  else
    # No HEAD yet. In a brand new repo, just check if we have any staged files.
    if [[ -z "$(git diff --cached --name-only)" ]]; then
      warn "No files staged for initial commit. Skipping commit and tag."
      return
    fi

    # Ensure branch exists for first commit
    git symbolic-ref HEAD "refs/heads/${branch}" >/dev/null 2>&1 || true
  fi

  local commit_msg="Release v${NEW_VERSION} (agentic_trust)"

  git commit -m "${commit_msg}"

  if git tag -l "v${NEW_VERSION}" >/dev/null 2>&1 && [[ -n "$(git tag -l "v${NEW_VERSION}")" ]]; then
    warn "Tag v${NEW_VERSION} already exists. Skipping tag creation."
  else
    git tag "v${NEW_VERSION}"
  fi

  if has_origin_remote; then
    info "Pushing branch '${branch}' and tag 'v${NEW_VERSION}' to origin"
    git push origin "${branch}"
    git push origin "v${NEW_VERSION}"
  else
    if create_remote_if_requested; then
      if has_origin_remote; then
        info "Pushing tag 'v${NEW_VERSION}' to origin"
        git push origin "v${NEW_VERSION}" || warn "Failed to push tag 'v${NEW_VERSION}'"
      fi
    else
      warn "Remote was not created. Tag 'v${NEW_VERSION}' exists only locally."
    fi
  fi
}

create_github_release_if_possible() {
  if ! command -v gh >/dev/null 2>&1; then
    warn "GitHub CLI 'gh' not found. Skipping GitHub release creation."
    return
  fi

  if ! has_origin_remote; then
    warn "No 'origin' remote configured. Skipping GitHub release creation."
    return
  fi

  info "Creating GitHub release v${NEW_VERSION} via gh CLI"

  if gh release view "v${NEW_VERSION}" >/dev/null 2>&1; then
    warn "GitHub release v${NEW_VERSION} already exists. Skipping release creation."
    return
  fi

  gh release create "v${NEW_VERSION}" \
    --title "v${NEW_VERSION}" \
    --notes "Release v${NEW_VERSION} (agentic_trust)" || warn "Failed to create GitHub release via gh CLI"
}

main() {
  print_header
  parse_args "$@"

  require_command git
  ensure_git_repo

  read_version
  compute_new_version

  echo "${GREEN}Current version:${RESET} ${CURRENT_VERSION}"
  echo "${GREEN}New version:    ${RESET} ${NEW_VERSION}"
  echo

  if [[ "${DRY_RUN}" == "true" ]]; then
    info "Dry run requested. No changes will be made."
    exit 0
  fi

  ensure_clean_or_warn
  update_version_file
  commit_and_tag
  create_github_release_if_possible

  echo
  info "Release v${NEW_VERSION} complete for project path '${PROJECT_REL_PATH}'."
}

main "$@"
