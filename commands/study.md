---
description: Sync new lessons and open the Learn by Doing study space
---

Open the user's study space, an Artifact, after syncing any lessons that are waiting. Do the steps in order and keep chat output to the final line.

1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/lbd.js" status`. It prints JSON with `lessons`, `pendingSync`, `artifactUrl`, `siteVersion`, `pluginVersion` and `sitePath`.
2. If `lessons` is 0, tell the user to ask Claude to commit some work first (or run `/learn-from-history`), and stop.
3. Publish the page when it does not exist yet or is out of date:
   - No `artifactUrl`: call the Artifact tool with `file_path` = `sitePath`, `capabilities` = `{"db": {}, "user": {}}`, `icon` = `book`, and the description "Your personal study space: lessons from the code you build with AI, with spaced review." Then run `node "${CLAUDE_PLUGIN_ROOT}/scripts/lbd.js" config set artifactUrl <the returned url>` and `config set siteVersion <pluginVersion>`.
   - `artifactUrl` set but `siteVersion` differs from `pluginVersion`: call the Artifact tool again with `url` = `artifactUrl`, `file_path` = `sitePath`, then `config set siteVersion <pluginVersion>`. Do not pass `icon` or `capabilities`.
4. Pull the learner profile the user saved in the study space. Call the ArtifactData tool with `action: "get"`, `url` = `artifactUrl`, `collection` = `data/users/me`, `doc_id` = `profile`. If the document exists, send its `data` as JSON on stdin to `node "${CLAUDE_PLUGIN_ROOT}/scripts/lbd.js" profile set`. If it does not exist, skip this step silently. This is how the choices made in the study space reach the lessons Claude writes next.
5. If `pendingSync` is above 0, run `node "${CLAUDE_PLUGIN_ROOT}/scripts/lbd.js" sync-plan`. It prints `{count, remaining, writes}`. Call the ArtifactData tool with `action: "batch"`, `url` = `artifactUrl` and `writes` exactly as printed. When it succeeds run `node "${CLAUDE_PLUGIN_ROOT}/scripts/lbd.js" mark-synced`. If `remaining` is above 0, repeat this step until it is 0. If a write fails, do not mark it as synced; report the error.
6. Open the study space with the Artifact tool, `action: "open"`, `url` = `artifactUrl`.
7. Reply with one line: how many lessons were synced and the link.

Privacy: the lessons contain small snippets of the user's code and are uploaded to their own private Artifact. The first time, say so in one sentence before step 3 and continue only if they do not object.
