param(
  [ValidateSet("patch", "minor", "major")]
  [string]$Bump = "patch"
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
  Write-Error $Message
  exit 1
}

function Exec([string]$Cmd) {
  Write-Host ">" $Cmd
  Invoke-Expression $Cmd
  if ($LASTEXITCODE -ne 0) { Fail "Command failed ($LASTEXITCODE): $Cmd" }
}

# 1) ensure on main
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne "main") {
  Fail "Release aborted: you must be on 'main' (currently '$branch')."
}

# Ensure working tree clean (staged + unstaged)
Exec "git update-index -q --refresh"
$dirty = git status --porcelain
if ($dirty) {
  Fail "Release aborted: working tree is dirty (staged or unstaged changes). Commit/stash first."
}

# Optional: ensure up-to-date with origin/main (best-effort)
try {
  Exec "git fetch origin main"
  $ahead = (git rev-list --count origin/main..main).Trim()
  $behind = (git rev-list --count main..origin/main).Trim()
  if ([int]$behind -gt 0) { Fail "Release aborted: local main is behind origin/main ($behind commits). Pull/rebase first." }
} catch {
  Write-Host "Warning: could not verify origin/main sync; continuing." -ForegroundColor Yellow
}

# 2) bump version, commit, tag (npm uses tag prefix 'v' by default)
Exec "npm version $Bump -m ""chore(release): v%s"""

# 3) push commit and tag
Exec "git push origin main"
Exec "git push origin --tags"

Write-Host "Release tag pushed. GitHub Actions should build and attach release/playr.exe to the GitHub Release." -ForegroundColor Green


