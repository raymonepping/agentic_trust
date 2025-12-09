You are a senior engineer working inside an existing workspace.

The workspace root already contains:
- a folder named `agentic_trust` with a Node.js backend
- a folder named `prompts` with at least `prompt_1.md`

You are not allowed to change any existing files in this prompt except where explicitly requested. You will add new files and initialize git for the `agentic_trust` project.

Goals:

1) Add semantic version tracking in the `agentic_trust` project
2) Add a mature Bash release script that bumps versions, tags, pushes, and optionally creates a GitHub release
3) Ensure a proper `.gitignore` is present for this Node project
4) Store this prompt itself as the next numbered prompt file inside `prompts/`

Perform the following steps exactly.

--------------------------------------------------
1) Create a version file in the project root
--------------------------------------------------

Create a new file `agentic_trust/VERSION` with the following content:

0.0.0

Nothing else.

This file represents the current semantic version of the `agentic_trust` project.

--------------------------------------------------
2) Initialize a git repository for agentic_trust
--------------------------------------------------

Inside the `agentic_trust` folder, initialize a new git repository for this project named `agentic_trust` if it is not already a git repo.

- Run the equivalent of:
  - `git init` (if needed)
  - Do not add or commit any files in this step
  - Do not configure any remote in this step – the user will configure `origin` later

You do not need to describe the commands in any file. This step is a repository level action.

--------------------------------------------------
3) Create a .gitignore for this project
--------------------------------------------------

Create `agentic_trust/.gitignore` with a complete and valid Node.js project ignore list. The file should be syntactically correct and contain at least the following sections:

- Node modules and package manager artefacts
- Logs and coverage output
- Build artefacts
- Environment files
- Editor and OS noise

Use exactly this content:

# Node dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
package-lock.json
yarn.lock
pnpm-lock.yaml

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Coverage
coverage/
.nyc_output/

# Build output
dist/
build/
tmp/
temp/

# Environment files
.env
.env.local
.env.*.local

# IDE and editor files
.vscode/
.idea/
*.iml
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db

# Misc
*.tgz
*.tar.gz
*.orig

Do not add anything else to `.gitignore`.

--------------------------------------------------
4) Create a release script with semantic version bumping
--------------------------------------------------

Create a new folder `agentic_trust/scripts` if it does not exist.

Inside it, create `agentic_trust/scripts/release.sh` with the following content. Make sure the file is valid Bash, has a proper shebang, uses colors for output, and includes a `--help` option.

Use this exact script content:

```bash
#!/usr/bin/env bash
set -euo pipefail

VERSION_FILE="VERSION"

RED=$'\e[31m'
GREEN=$'\e[32m'
YELLOW=$'\e[33m'
BLUE=$'\e[34m'
BOLD=$'\e[1m'
RESET=$'\e[0m'

print_header() {
  echo "${BLUE}${BOLD}agentic_trust release script${RESET}"
  echo
}

usage() {
  cat <<EOF
Usage: $(basename "$0") [--patch|--minor|--major] [--dry-run] [--help]

Options:
  --patch        Bump patch version (X.Y.Z -> X.Y.(Z+1))
  --minor        Bump minor version (X.Y.Z -> X.(Y+1).0)
  --major        Bump major version (X.Y.Z -> (X+1).0.0)
  --dry-run      Show what would happen without making changes
  --help         Show this help and exit

Examples:
  $(basename "$0") --patch
  $(basename "$0") --minor
  $(basename "$0") --major
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
  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    error "This script must be run from inside a git repository (agentic_trust)"
    exit 1
  fi
}

read_version() {
  if [[ ! -f "${VERSION_FILE}" ]]; then
    warn "VERSION file not found, creating one with 0.0.0"
    echo "0.0.0" > "${VERSION_FILE}"
  fi

  local raw
  raw=$(<"${VERSION_FILE}")

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
  local status
  status=$(git status --porcelain)

  if [[ -n "$status" ]]; then
    warn "Working tree is not clean. All changes will be committed as part of this release."
    echo "$status"
  fi
}

update_version_file() {
  echo "${NEW_VERSION}" > "${VERSION_FILE}"
}

commit_and_tag() {
  local branch
  branch=$(git rev-parse --abbrev-ref HEAD)

  git add -A

  if git diff --cached --quiet; then
    warn "No changes to commit. Skipping commit and tag."
    return
  fi

  local commit_msg="Release v${NEW_VERSION}"

  git commit -m "${commit_msg}"

  if git tag -l "v${NEW_VERSION}" >/dev/null 2>&1 && [[ -n "$(git tag -l "v${NEW_VERSION}")" ]]; then
    warn "Tag v${NEW_VERSION} already exists. Skipping tag creation."
  else
    git tag "v${NEW_VERSION}"
  fi

  info "Pushing branch '${branch}' and tag 'v${NEW_VERSION}' to origin"

  git push origin "${branch}"
  git push origin "v${NEW_VERSION}"
}

create_github_release_if_possible() {
  if ! command -v gh >/dev/null 2>&1; then
    warn "GitHub CLI 'gh' not found. Skipping GitHub release creation."
    return
  fi

  info "Creating GitHub release v${NEW_VERSION} via gh CLI"

  if gh release view "v${NEW_VERSION}" >/dev/null 2>&1; then
    warn "GitHub release v${NEW_VERSION} already exists. Skipping release creation."
    return
  fi

  gh release create "v${NEW_VERSION}" \
    --title "v${NEW_VERSION}" \
    --notes "Release v${NEW_VERSION}" || warn "Failed to create GitHub release via gh CLI"
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
  info "Release v${NEW_VERSION} complete."
}

main "$@"
```

After creating all files, do not modify anything else.
