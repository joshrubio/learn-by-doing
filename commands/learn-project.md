---
description: Build a few base lessons and a memory of the structure of the current project
argument-hint: "[path/to/repo]"
---

Build the project primer for the repo at `$ARGUMENTS` (default: the current repo). It leaves two things: a memory of what the project is and how it is laid out, which the commit hook hands back to Claude on every later commit, and 4 to 6 base lessons about the project itself. Follow the "Project primer" section of the learn-by-doing skill step by step.

1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/lbd.js" repo status --project "<repo dir>"`. If `learn` is not `true`, say in one line that learning is not turned on here and that `/learn-repo on` does it, and stop.
2. If `memory` is `true`, ask the user once with AskUserQuestion whether to rebuild it ("Ya hay una memoria de este proyecto. ¿La rehago?") with the options "Sí, rehacerla" and "No, dejarla". On "No", stop. Rebuilding refreshes the memory and adds only base lessons for concepts that do not exist yet.
3. Do the primer as the skill describes.
4. Reply with one line in the user's language: how many base lessons were saved, that the memory is stored, and that `/study` syncs them.
