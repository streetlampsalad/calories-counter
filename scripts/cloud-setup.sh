#!/usr/bin/env bash
# Environment setup script for Claude Code cloud agents (docs/adr/0006, 0007).
# The cloud environment's "Setup script" field holds this line, not this file's contents, because
# setup runs outside the repo, which the cloud clones to /home/user/calories-counter:
#   cd /home/user/calories-counter && bash scripts/cloud-setup.sh
# It is safe to re-run. There is no Docker in the cloud, so it installs only what
# `pnpm validate:fast` needs: Node 24, pnpm, the dependencies and the git hooks.
set -euo pipefail

# Work from the repo root whatever directory it was started in.
cd "$(dirname "${BASH_SOURCE[0]}")/.."

want_node="$(cut -d. -f1 .nvmrc)"
node_major() { "${1:-node}" -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo none; }

# The cloud image ships several Node versions side by side (/opt/node24/bin) and keeps nvm in
# /opt/nvm, which cannot download Node there. So use a Node that is already installed first,
# and fall back to nvm only when none is. NODE_SEARCH_DIRS overrides the search for tests.
find_node_bin() {
  local dir
  for dir in ${NODE_SEARCH_DIRS:-/opt/node${want_node} /opt/node${want_node}.* /usr/local/lib/nodejs/node-v${want_node}.*}; do
    if [ -x "$dir/bin/node" ] && [ "$(node_major "$dir/bin/node")" = "$want_node" ]; then
      printf '%s\n' "$dir/bin"
      return 0
    fi
  done
  return 1
}

# The agent's later shells start from the profile, and the git hooks they run inherit its
# PATH, so the chosen Node goes into ~/.bashrc and into the login file bash actually reads.
# The line goes first, ahead of the stock "interactive shells only" guard that returns early.
persist_path() {
  local line="export PATH=\"$1:\$PATH\" # cloud-setup.sh: Node $want_node" profile
  local login="$HOME/.profile"
  [ -f "$HOME/.bash_login" ] && login="$HOME/.bash_login"
  [ -f "$HOME/.bash_profile" ] && login="$HOME/.bash_profile"
  for profile in "$HOME/.bashrc" "$login"; do
    touch "$profile"
    sed -i '/# cloud-setup.sh: Node/d' "$profile"
    { printf '%s\n' "$line"; cat "$profile"; } > "$profile.cloud-setup" && mv "$profile.cloud-setup" "$profile"
  done
}

if [ "$(node_major)" != "$want_node" ]; then
  if node_bin="$(find_node_bin)"; then
    export PATH="$node_bin:$PATH"
    persist_path "$node_bin"
  else
    nvm_dir=""
    for candidate in "${NVM_DIR:-}" "$HOME/.nvm" /opt/nvm; do
      if [ -n "$candidate" ] && [ -s "$candidate/nvm.sh" ]; then nvm_dir="$candidate"; break; fi
    done
    if [ -z "$nvm_dir" ]; then
      echo "Node $want_node is required (found: $(node_major)), and neither an installed Node $want_node nor nvm was found." >&2
      exit 1
    fi
    export NVM_DIR="$nvm_dir"
    # nvm does not support `set -eu`.
    set +eu
    # shellcheck disable=SC1091
    . "$NVM_DIR/nvm.sh"
    nvm install "$want_node" && nvm alias default "$want_node"
    nvm_node="$(nvm which "$want_node")"
    set -eu
    [ -x "$nvm_node" ] || { echo "nvm could not install Node $want_node." >&2; exit 1; }
    persist_path "$(dirname "$nvm_node")"
  fi
fi

# package.json pins pnpm in "packageManager"; corepack installs that exact version.
corepack enable
corepack prepare --activate >/dev/null 2>&1 || true

# Also runs lefthook's postinstall, which installs the git hooks.
pnpm install --frozen-lockfile

echo "Cloud agent environment ready (node $(node -v), pnpm $(pnpm -v))."
