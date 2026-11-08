---
description: Turn the most instructive past commits of a repo into lessons
argument-hint: "[path to repo] [max commits]"
---

Build lessons from a repository's history, using the `learn-by-doing` skill. Arguments: `$ARGUMENTS` (a repo path, default the current directory, and an optional maximum number of commits, default 8).

0. The user asking for this is their decision to learn from this repo. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/lbd.js" repo status --project "<repo>"`. If `learn` is `false`, stop and tell them the repo is turned off, and that `/learn-repo on` changes it. If it is `null` or `true`, run `repo enable --project "<repo>"` and continue.
1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/lbd.js" history "<repo>" --limit <max>`. It ranks past commits by how much they teach (size, number of areas, kind of change) and skips commits that already have lessons.
2. Show the user the candidate list (hash, date, subject) in a short table and ask which to use, defaulting to all. This step can cost many tokens, so never skip the confirmation.
3. For each chosen commit, in order: read it with `git -C "<repo>" show <hash> --stat` and the patch limited to the files that matter, then write lessons following the skill, including `"date"` in `commit`. Apply the same rules: at most 3 lessons per commit, reuse existing concept slugs, context first, no secrets.
4. Save each commit's lessons with `node "${CLAUDE_PLUGIN_ROOT}/scripts/lbd.js" add --project "<repo>"` and the JSON on stdin.
5. Finish with one line: how many lessons were saved and that `/study` syncs and opens them.

Do not process more commits than the user confirmed.
