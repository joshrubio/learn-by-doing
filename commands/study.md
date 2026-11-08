---
description: Open the Learn by Doing study space for this project
---

Build and open the study space for the current project.

1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/lbd.js" build --project "<current project dir>"`. It writes `.learn/study.html` and prints the path.
2. If it reports no lessons, tell the user to ask Claude to commit some work first, and stop.
3. Open the file in the user's browser: on Windows `start "" "<path>"`, on macOS `open "<path>"`, on Linux `xdg-open "<path>"`.
4. Reply with one line: how many lessons are pending and where the file is. Do not explain the lessons here.

If the user also wants it as a shareable page, offer once to publish `.learn/study.html` as an Artifact, and mention that this uploads the lesson code snippets to claude.ai.
