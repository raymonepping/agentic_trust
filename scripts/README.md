# `scripts/` directory

This folder contains small automation helpers that support the `agentic_trust` project.

They are intended to be:

- Safe to run from the project root
- Self contained
- Focused on common workflows such as releases, frontend relocation, and seeding demo data

> All scripts assume a Unix-like environment with Bash available. Examples use relative paths and can be run from the repository root unless stated otherwise.

---

## Overview

```csv
| File                    | Type      | Purpose                                                                 |
| ----------------------- | --------- | ----------------------------------------------------------------------- |
| `release.sh`            | Script    | Handles semantic versioning, tagging, and GitHub releases               |
| `relocate_frontend.sh`  | Script    | Safely relocates a Nuxt frontend tree into `./frontend`                 |
| `seed_missions.sh`      | Script    | Seeds demo missions using `missions_seed.json`                          |
| `connection_test.sh`    | Script    | Connectivity and environment sanity checks                              |
| `missions_seed.json`    | Data      | JSON file with example missions for seeding                             |
| `mission_questions.md`  | Docs      | Example questions to ask the mission agent                              |
```

---

## Common prerequisites

Some scripts expect the following tools to be available:

- `bash`
- `git`
- `rsync`
- `curl`
- `gh` (GitHub CLI, optional but used by `release.sh`)
- A working `git` repository for this project

If a required command is missing, the scripts will print a clear error and exit.

---

## `release.sh`

Release helper for the `agentic_trust` project.

### Responsibilities

- Reads the current version from the `VERSION` file in the project root
- Optionally bumps the version using semantic versioning
- Commits changes under the project path
- Tags the release
- Optionally pushes to `origin` and creates a GitHub release if possible
- Supports a “commit only” mode when no bump flag is provided

### Usage

From the project root:

```bash
./scripts/release.sh [--patch|--minor|--major] [--dry-run] [--init-remote]
````

#### Modes

* `--patch`
  `X.Y.Z` becomes `X.Y.(Z+1)`

* `--minor`
  `X.Y.Z` becomes `X.(Y+1).0`

* `--major`
  `X.Y.Z` becomes `(X+1).0.0`

* **No bump flag**
  If you call the script without `--patch`, `--minor`, or `--major`, it will:

  * Show that it is running in **commit only mode**
  * Stage changes under the project path
  * Commit and push using `commit_gh` if that command is available
  * Otherwise fall back to a normal `git commit` flow

#### Additional options

* `--dry-run`
  Prints what would happen without making any changes.

* `--init-remote`
  When no `origin` remote exists, the script tries to create one using the GitHub CLI (`gh repo create ...`) and push the current branch.

### Notes

* The script is aware of the repository root and the project root. It will only stage and commit files in the project path, not unrelated parent folders.
* If there are no staged changes, it will skip commit and tagging.

---

## `relocate_frontend.sh`

Relocates an existing Nuxt frontend project into the `frontend/` folder of this repository using `rsync`.

Typical case:

* You start with a standalone `agentic_trust_frontend` repo or folder.
* You want that Nuxt app to live inside `agentic_trust/frontend`.

### Usage

From the `agentic_trust` repo root:

```bash
./scripts/relocate_frontend.sh <source_dir> <destination_dir>
```

Example:

```bash
./scripts/relocate_frontend.sh ../agentic_trust_frontend ./frontend
```

### What it does

1. Resolves both **source** and **destination** paths

2. Verifies that the source exists

3. If the destination does not exist yet:

   * Verifies that the parent folder exists
   * Creates the destination directory

4. Guardrail: checks for running processes that reference the **source path**

   * If anything is found (for example `npm run dev`, `nuxt dev`, or `node`), the script aborts

5. Uses `rsync` to sync files:

   * Excludes:

     * `node_modules`
     * `.nuxt`
     * `.output`
     * `.git`
     * `.idea`
     * `.vscode`

6. Verifies that the destination contains:

   * `package.json`
   * At least one of `app/`, `pages/`, or `components/`

7. Prints a small folder overview using `tree` if available

8. Prints suggested next steps

### Example next steps

After a successful run, the script prints something like:

```text
Next steps:
  1. cd "<absolute path to frontend>"
  2. npm install
  3. npm run dev
  4. Restart your backend in its usual location.
```

Once you are happy with the new layout, you can manually remove the old source folder.

---

## `seed_missions.sh` and `missions_seed.json`

These files together provide a basic way to seed the system with example missions.

* `missions_seed.json`
  Contains example mission definitions in JSON format.

* `seed_missions.sh`
  Reads that JSON and interacts with the backend to insert demo missions.
  The concrete behavior and endpoint configuration are inside the script itself.

### Usage

From the project root:

```bash
./scripts/seed_missions.sh
```

Typical outcome:

* A set of demo missions is created
* Those missions appear on the frontend missions page after reload

If you change `missions_seed.json`, rerunning the script lets you quickly repopulate a development environment.

---

## `connection_test.sh`

Helper script used to validate basic connectivity in a development environment.

Typical checks include:

* Whether key endpoints and ports are reachable
* Whether the backend responds as expected

Exact behavior is defined in the script itself. You can open it to see the individual checks.

### Usage

From the project root:

```bash
./scripts/connection_test.sh
```

Use this when you want to confirm that your local stack is up before chasing errors in the UI or agent logic.

---

## `mission_questions.md`

A small helper document which collects example questions to ask the mission agent.

Typical uses:

* Smoke testing the backend agent from the UI
* Demonstrating capabilities during a demo
* Providing inspiration for realistic mission-related prompts

You can extend this file with your own questions as the project evolves.

---

## Conventions

* All scripts are written in Bash with `set -euo pipefail` for safety.
* Scripts try to fail fast with clear error messages instead of silent partial changes.
* Whenever external tools such as `git`, `rsync`, or `gh` are required, the scripts check for them first.

If you add new scripts, following the same style and adding a short section to this `README` will keep future you very happy.

```
```
