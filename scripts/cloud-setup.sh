#!/usr/bin/env bash
# Environment setup script for Claude Code cloud agents (docs/adr/0006).
# Paste `bash scripts/cloud-setup.sh` into the cloud environment's "Setup script" field.
# It is safe to re-run. There is no Docker in the cloud, so it installs only what
# `pnpm validate:fast` needs: Node 24, pnpm and the dependencies.
set -euo pipefail

want_node="$(cut -d. -f1 .nvmrc)"
have_node="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo none)"

if [ "$have_node" != "$want_node" ]; then
  if [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
    # shellcheck disable=SC1091
    . "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
    nvm install "$want_node"
    nvm alias default "$want_node"
  else
    echo "Node $want_node is required (found: $have_node) and nvm is not available." >&2
    exit 1
  fi
fi

# package.json pins pnpm in "packageManager"; corepack installs that exact version.
corepack enable
corepack prepare --activate >/dev/null 2>&1 || true

# Also runs lefthook's postinstall, which installs the git hooks.
pnpm install --frozen-lockfile

echo "Cloud agent environment ready (node $(node -v), pnpm $(pnpm -v))."
