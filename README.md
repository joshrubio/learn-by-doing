# Learn by Doing

A Claude Code plugin for people who learn to code by working with AI. Every time Claude makes a git commit, the plugin turns the code that was actually written into a few short lessons. You study them later, at your own pace, in a personal study space that remembers what you know across all your projects.

Most of your code will be written by AI. What you need is the ability to read it, review it and decide. So the exercises train understanding and judgment, and you never have to write code if you do not want to.

Nothing interrupts your work. The lessons wait until you open the study space.

> Status: prototype (v0.3.0). The study space is in Spanish for now.

## Requirements

You need all of these before installing.

| Requirement | Why |
| --- | --- |
| [Claude Code](https://code.claude.com), signed in | The plugin runs inside it. |
| A claude.ai account that can publish Artifacts | The study space is an Artifact in your account. Without it the plugin still saves lessons locally, but there is nowhere to read them. |
| Node.js 18 or newer | The hook and the scripts are plain Node, no packages to install. |
| git | Lessons are generated from your commits. |

Works on Windows, macOS and Linux. There are no bash scripts.

## Install

Inside Claude Code:

```
/plugin marketplace add joshrubio/learn-by-doing
/plugin install learn-by-doing@learn-by-doing
```

Restart the session after installing.

## Use

1. Work as usual and ask Claude to commit. The plugin saves 1 to 3 lessons per commit (up to 4 for a large one) and adds a single line to Claude's reply.
2. Run `/study`. It syncs the new lessons and your profile to your study space and opens it. The first time it creates the Artifact in your account and tells you that code snippets are uploaded to it.
3. The first time you open the study space it asks how you want to learn (see below). Then study.

To learn from repos you already have:

```
/learn-from-history path/to/repo 8
```

It ranks the repo's past commits by how much they teach, shows you the list and waits for your confirmation before spending anything.

| Command | What it does |
| --- | --- |
| `/study` | Sync new lessons and your profile, then open the study space |
| `/learn-setup` | Choose how you want to learn from the terminal, without opening the study space |
| `/learn-from-history [repo] [max]` | Turn the most instructive past commits into lessons |

## Every lesson has the same shape

Context, predict, concept, one exercise, result.

1. **Context.** Which project, what was being built, and what you are about to learn. Before any code.
2. **Predict.** You commit to a guess before reading the explanation.
3. **Concept.** A short mental model, not a definition.
4. **Exercise.** Exactly one, always from the kinds you chose.
5. **Result.** Right, partly right or not yet. It feeds the spaced review.

Only the exercise changes between lessons, so the method always feels the same.

## Choose how you practice

You pick this once at the start, and can change it later with the "Cambiar mi configuración" button in the study space. A change only affects new lessons. Lessons you already have keep their exercise.

| Family | Exercises | What it trains |
| --- | --- | --- |
| **Recordar** | Opción múltiple, Recuerdo libre | Retaining and telling options apart |
| **Explicar** | Explícalo con tus palabras, Justifica una decisión, Compara dos diseños | Reasoning in your own words |
| **Leer código** | Predice qué hace, Encuentra el error, Revisa un cambio | Understanding and reviewing code you did not write |

An optional 3-minute diagnostic asks how well you know 12 topics (fundamentals and architecture). From it the study space recommends exercises, marks topics you already master (the plugin skips them) and topics that are rusty (taught as a short refresher).

Open exercises are graded against key points by Claude, using the Artifact's ask-Claude capability. That uses your own Claude usage, asks for your consent the first time, and never runs on its own. If it is unavailable or you decline, you compare with a model answer and rate yourself.

## What you get in the study space

- **Inicio**: what the tool is, a small dashboard (lessons, to study, to review, mastered, progress per project, recent lessons) and these install instructions.
- **Lecciones**: filter by project, area and state, grouped by commit.
- **Repaso**: spaced review with intervals of 1, 3, 7, 16 and 35 days. A concept you got wrong goes back to the start; a partly right one stays where it is.
- **Conceptos**: everything you have seen, with its state and in how many projects it appeared. A concept has one state, shared by all your projects.
- **Perfil**: your exercise choices, with the button to change them.

States: new, learning, rusty (due for review), mastered.

## How it works

```
git commit by Claude
   -> PostToolUse hook (Node) reads the commit: message, areas, patch, and your profile
   -> the learn-by-doing skill writes lessons and saves them with lbd.js
   -> ~/.learn-by-doing/store.json   (all projects, source of truth)
/study
   -> pulls your profile from the study space into ~/.learn-by-doing/profile.json
   -> lbd.js sync-plan  ->  one batched write to the Artifact database
   -> the Artifact reads lessons live and keeps your progress under your private user path
```

- The skill teaches the why, not the syntax. Lesson types: `concepto`, `decision` (architecture trade-offs), `riesgo`, `lectura`.
- The script rejects any lesson whose exercise is not one of the kinds you enabled.
- Large commits are split by area and only the most valuable lessons are kept.
- Concepts are global. If the same concept shows up in another repo it is recorded as an appearance, not as a duplicate lesson.
- Your progress and profile live in the Artifact database under `data/users/<your id>/`, private to you, and survive republishing the page.

To pause the plugin, create an empty file `~/.learn-by-doing/off`, or `.learn-off` in a single project. Set `LBD_HOME` to keep the store somewhere else.

## Privacy

- Lessons are generated and stored on your machine in `~/.learn-by-doing/`.
- Only `/study` uploads them, to your own Artifact, which is private by default. Sharing it is up to you from the Artifact's Share menu.
- The skill is instructed to include only the few lines that illustrate a concept, never a whole file or diff, and never secrets, tokens or personal data. That is an instruction to the model, so skim your lessons before sharing the Artifact with anyone.
- Anyone who can open the Artifact can read the lessons in it.
- When Claude grades an answer, your answer and the lesson text are sent to Claude from your browser, on your own account.

## Known limits

- Only commits Claude makes inside a Claude Code session are noticed. Commits you make by hand are not.
- The hook was tested with simulated input. If Claude Code changes the shape of the tool result, the commit detection may need an update. Please open an issue.
- A profile change reaches the lessons Claude writes after your next `/study`, because the plugin reads the profile then.
- Lesson quality depends on Claude following the skill. The script validates the shape of each lesson, not its content.
- Creating the Artifact the first time and each sync ask for your approval in Claude Code.
- If two concepts mean the same thing under different names, they are kept apart. The skill is told to reuse existing names, which prevents most of it.

## Ideas for later

- Export lessons as Markdown notes with frontmatter, for Obsidian or any editor.
- Semantic search across lessons once a store is large enough to need it.

## License

MIT
