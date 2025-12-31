#!/usr/bin/env bash
set -euo pipefail

BUMP="${1:-patch}"

case "$BUMP" in
  patch|minor|major) ;;
  *)
    echo "Release aborted: bump must be one of: patch | minor | major (got '$BUMP')." >&2
    exit 1
    ;;
esac

fail() {
  echo "Release aborted: $1" >&2
  exit 1
}

exec_cmd() {
  echo "> $*"
  "$@"
}

# 1) ensure on main
branch="$(git rev-parse --abbrev-ref HEAD)"
[[ "$branch" == "main" ]] || fail "you must be on 'main' (currently '$branch')."

# ensure clean tree
git update-index -q --refresh || true
if [[ -n "$(git status --porcelain)" ]]; then
  fail "working tree is dirty (staged or unstaged changes). Commit/stash first."
fi

# Optional: ensure up-to-date with origin/main (best-effort)
if git fetch origin main >/dev/null 2>&1; then
  behind="$(git rev-list --count main..origin/main)"
  if [[ "$behind" != "0" ]]; then
    fail "local main is behind origin/main ($behind commits). Pull/rebase first."
  fi
else
  echo "Warning: could not verify origin/main sync; continuing." >&2
fi

# 2) bump version, commit, tag (npm uses 'v' prefix by default)
exec_cmd npm version "$BUMP" -m "chore(release): v%s"

# 3) push commit and tag
exec_cmd git push origin main
exec_cmd git push origin --tags

echo "Release tag pushed. GitHub Actions should build and attach release/playr.exe to the GitHub Release."


