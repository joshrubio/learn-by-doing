---
name: learn-by-doing
description: Turns a git commit into a few short lessons saved for later study. Use when a [learn-by-doing] message reports a commit that was just made, or when the user asks to turn recent work into lessons.
---

# Learn by Doing

Goal: the user is learning to code by working with AI. After each commit, save a few lessons about the code that was actually written, so they can study it later. Never interrupt their work and never teach in chat.

## When it runs

A hook adds a `[learn-by-doing]` message after a commit, with the commit hash, size, changed areas and the patch. Follow it silently, save the lessons, then end your reply with one line saying how many were saved and that `/study` opens them.

## Profile (optional)

If `.learn/profile.json` exists, read it first. Fields, all optional:
- `language`: language of the lessons. Default: the language the user writes in.
- `emphasis`: weights per lesson type, for example `{"decision": 3, "concepto": 1}`. A higher weight means choose that type more often.
- `rusty`: concepts the user studied long ago and forgot. Teach these as a short refresher, not from zero.
- `known`: concepts to skip.

Run `node <plugin>/scripts/lbd.js list` to see lessons already saved. Do not repeat a concept that is already there. If the code uses it again, skip it, the app handles repeats.

## What to teach

Teach the why, not the syntax. Pick at most 3 lessons per commit (1 or 2 for a small one). Rank candidates by:
1. New for this user. Skip what they clearly know.
2. Leverage. Concepts that appear everywhere (state, async, validation, separation of concerns, error handling, paradigms such as functional or object-oriented) beat a library detail.
3. Risk. A bug, a security hole or an edge case the change avoids or introduces goes up.

Skip formatting, renames, dependency bumps, generated files and trivial config.

## Lesson types

| type | teaches | check |
| --- | --- | --- |
| `concepto` | what it is and why it appears here | what happens if this line is removed |
| `decision` | the alternative that was not chosen and the trade-off, plus where the piece lives, what it is responsible for, and why it is separate | when would you pick the other option |
| `riesgo` | a bug, security issue or edge case | find what breaks with this input |
| `lectura` | how to follow the flow from input to output | predict the output |

Choose the type from what the commit contains, not one type for the whole project. When the profile favors architecture, prefer `decision` lessons and always answer where, what responsibility, and why separated.

## Large commits

If the hook says LARGE, do not summarize the whole commit. Split by area, take the most valuable lesson from each of the 2 or 3 most important areas, and ignore the rest. Never exceed 4 lessons. Mention in your reply that the commit was large and only part of it became lessons.

## Lesson structure

Context first, then practice, then theory. A reader who opens a lesson cold must know where they are before seeing any code:
0. `context`, three short plain-language sentences, written for someone who has not looked at the commit:
   - `building`: what the commit or feature was building, in product terms ("a login endpoint so users can sign in with email and password"), never a restatement of the diff.
   - `snippetRole`: what this snippet does inside that, in one sentence ("this is the route that receives the login form").
   - `learning`: the one concept this lesson teaches, as a promise to the reader ("you will see why a route should not talk to the database directly").
   The project name is added automatically. The `title` must name the concept, not the file.
1. `code`: the user's real code, at most 15 lines, only the lines that illustrate the concept. Never paste the whole diff.
2. `predict`: one short question to think about before reading the explanation.
3. `explain`: the concept in 3 or 4 lines, as a mental model and not a textbook definition.
4. `challenge`: one small task (modify, predict, or find the bug).
5. `check`: a multiple choice question with 3 or 4 options, `answer` as the index of the right one, and `why` explaining it. Put the right answer in a varied position, never always first. Make wrong options plausible mistakes.
6. `related`: concept slugs this connects to.

## Saving

Send JSON on stdin to the script, with `--project <dir>` set to the project directory (the hook message gives the exact command):

```
node "<plugin>/scripts/lbd.js" add --project "<dir>" <<'EOF'
{
  "commit": { "hash": "abc1234", "message": "add login route" },
  "lessons": [
    {
      "type": "decision",
      "area": "backend",
      "concept": "separation-of-concerns",
      "title": "Why the route does not talk to the database directly",
      "context": {
        "building": "A login endpoint so users can sign in with email and password.",
        "snippetRole": "This is the route that receives the login request and answers with the user or an error.",
        "learning": "Why a route should hand work to a service instead of querying the database itself."
      },
      "code": { "file": "src/routes/login.js", "text": "..." },
      "predict": "What would break if the route queried the database itself?",
      "explain": "...",
      "challenge": "...",
      "check": { "question": "...", "options": ["...", "...", "..."], "answer": 1, "why": "..." },
      "related": ["layered-architecture"]
    }
  ]
}
EOF
```

`area` is one of: frontend, backend, base-de-datos, tests, config, codigo, docs, otros. `concept` is a short kebab-case slug, stable across commits so repeats are detected. The script rejects invalid lessons and prints why, fix and resend.

## Privacy

Lessons live in `.learn/` inside the project and that folder ignores itself in git. Do not include secrets, tokens or personal data in `code`.
