#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-2.0-or-later
# Development helper: builds and tests the extension, copies it to TARGET
# through the SSH jump host JUMP (for a TARGET only reachable from JUMP)
# and runs install.sh there. Exits non-zero if any step,
# including the remote install, fails.
#
# Usage: ./deploy.sh [install.sh options]
#        ./deploy.sh                   install the current build
#        ./deploy.sh --rollback        put the previous version back
set -euo pipefail
cd "$(dirname "$0")"

# Hosts live in deploy.env (not in git, see deploy.env.example).
[ -f deploy.env ] || { echo "deploy: copy deploy.env.example to deploy.env and fill it in" >&2; exit 1; }
# shellcheck source=/dev/null
. ./deploy.env
: "${TARGET:?deploy: TARGET not set in deploy.env}" "${JUMP:?deploy: JUMP not set in deploy.env}"
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=10)

rollback=false
case " $* " in *" --rollback "*) rollback=true ;; esac

if ! $rollback; then
    npm run --silent check
    npm test --silent
    npm run --silent build
fi

tarball=$(mktemp --suffix=.tgz)
jump_tmp=
target_tmp=
cleanup() {
    rm -f "$tarball"
    [ -n "$jump_tmp" ] && ssh "${SSH_OPTS[@]}" "$JUMP" "rm -f $jump_tmp" || true
    # remote-install.sh deletes it too; this covers a failed copy or run.
    [ -n "$target_tmp" ] && ssh "${SSH_OPTS[@]}" "$JUMP" "ssh ${SSH_OPTS[*]} $TARGET 'rm -f $target_tmp'" || true
}
trap cleanup EXIT
files=(install.sh data)
$rollback || files+=(build/scratchpad@exclude-barrier.github.io)
tar czf "$tarball" "${files[@]}"

# Unique temp files on both hosts instead of fixed /tmp names.
jump_tmp=$(ssh "${SSH_OPTS[@]}" "$JUMP" "mktemp --suffix=.tgz")
target_tmp=$(ssh "${SSH_OPTS[@]}" "$JUMP" "ssh ${SSH_OPTS[*]} $TARGET 'mktemp --suffix=.tgz'")
[ -n "$jump_tmp" ] && [ -n "$target_tmp" ] || { echo "deploy: no temp file on remote" >&2; exit 1; }

scp -q "${SSH_OPTS[@]}" "$tarball" "$JUMP:$jump_tmp"
ssh "${SSH_OPTS[@]}" "$JUMP" "scp -q ${SSH_OPTS[*]} $jump_tmp $TARGET:$target_tmp"

# The jump host's login shell may not be bash (fish, zsh): keep the remote
# command free of bash syntax and send the actual script on stdin through
# both hops.
ssh "${SSH_OPTS[@]}" "$JUMP" "ssh ${SSH_OPTS[*]} $TARGET 'bash -s -- $target_tmp $*'" \
    < scripts/remote-install.sh
