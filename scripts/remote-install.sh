#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-2.0-or-later
# Runs on the target machine (deploy.sh feeds it via stdin):
# unpacks the deploy tarball into a private temp dir, runs install.sh and
# cleans up. The exit code is install.sh's, so a failed install fails the
# deploy.
#
# Usage: bash -s -- <tarball> [install.sh args]
set -uo pipefail

tarball=$1
shift
dir=$(mktemp -d)
trap 'rm -rf "$dir" "$tarball"' EXIT

tar xzf "$tarball" -C "$dir" || { echo "remote-install: cannot unpack $tarball" >&2; exit 1; }
export DBUS_SESSION_BUS_ADDRESS=${DBUS_SESSION_BUS_ADDRESS:-unix:path=/run/user/$(id -u)/bus}
bash "$dir/install.sh" "$@"
