#!/bin/bash
# SessionStart hook for Claude Code on the web.
#
# Guarantees every fresh web session is ready to build & verify the site by
# delegating to the existing, idempotent scripts/setup.sh (deps + Playwright +
# a build smoke test). Kept web-only so local sessions aren't forced through
# the full Playwright/build install on every start.
set -euo pipefail

# Only run in remote (Claude Code on the web) sessions.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

exec "$CLAUDE_PROJECT_DIR/scripts/setup.sh"
