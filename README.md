# Learn by Doing

A Claude Code plugin for people who learn to code by working with AI. Every time Claude makes a git commit, the plugin turns the code that was actually written into a few short lessons, and you study them later in your own study space. Nothing interrupts your work.

> Status: working prototype (v0.1.0). The lesson UI is in Spanish for now.

## How it works

1. You ask Claude to commit. A `PostToolUse` hook notices the commit and hands Claude the commit message, the changed areas (frontend, backend, tests...) and the patch.
2. The `learn-by-doing` skill picks at most 3 lessons that are worth teaching (4 for a large commit, split by area), and saves them in `.learn/lessons.json` inside your project. That folder ignores itself in git.
3. `/study` builds `.learn/study.html` and opens it. Three tabs:
   - **Pendientes**: new lessons grouped by commit, filterable by area. Predict first, then read the concept, a small challenge and a check question.
   - **Repaso**: concepts that got rusty, as quick spaced-repetition questions.
   - **Progreso**: counts by state (new, learning, rusty, mastered) and by area.

Lessons teach the why, not the syntax. Types: `concepto`, `decision` (architecture trade-offs), `riesgo`, `lectura`.

## Install

```
/plugin marketplace add joshrubio/learn-by-doing
/plugin install learn-by-doing@learn-by-doing
```

Requires Node 18 or newer and git.

## Optional profile

Create `.learn/profile.json` in a project to bias what gets taught:

```json
{
  "language": "es",
  "emphasis": { "decision": 3, "concepto": 1 },
  "rusty": ["functional-programming"],
  "known": ["variables"]
}
```

To pause the plugin in a project, create an empty file `.learn/off`.

## Privacy

Everything stays on your machine: lessons in `.learn/`, progress in your browser's local storage. Lessons contain small snippets of your code, so do not publish `.learn/study.html` anywhere you would not publish the code.

## Known limits

- Only commits Claude makes inside a Claude Code session are noticed. Commits you make by hand are not.
- Progress lives in the browser that opened the file. A different browser or path starts from zero.
- Lesson quality depends on Claude following the skill. The script validates the shape of each lesson, not its content.

## License

MIT
