---
description: Turn learning on or off for the current repo, or see its status
argument-hint: "[on|off|status]"
---

Manage whether Learn by Doing learns from the current repository. Argument: `$ARGUMENTS` (default `status`).

- `status`: run `node "${CLAUDE_PLUGIN_ROOT}/scripts/lbd.js" repo status --project "<current repo dir>"` and say in one line whether learning is on, off, or not decided yet for this repo.
- `on`: run `node "${CLAUDE_PLUGIN_ROOT}/scripts/lbd.js" repo enable --project "<current repo dir>"`. Tell the user in one sentence that lessons are generated from each commit and `/study` uploads snippets to their own private study space.
- `off`: run `node "${CLAUDE_PLUGIN_ROOT}/scripts/lbd.js" repo disable --project "<current repo dir>"`. Say that no more lessons will be written here and that existing ones are kept.

Reply with one line. Turning a repo off does not delete its lessons.
