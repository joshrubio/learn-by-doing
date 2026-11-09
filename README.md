# Learn by Doing

A Claude Code plugin for people who learn to code by working with AI. Every time Claude makes a git commit in a repo you turned on, the plugin turns the code that was actually written into a few short lessons. They are saved as plain Markdown notes, and you study them later, at your own pace, in a personal study space that remembers what you know across all your projects.

Most of your code will be written by AI. What you need is the ability to read it, review it and decide. So the exercises train understanding and judgment, and you never have to write code if you do not want to.

Nothing interrupts your work. The lessons wait until you open the study space.

> Status: prototype (v0.9.0). The study space is in Spanish for now.

## Requirements

You need all of these before installing.

| Requirement | Why |
| --- | --- |
| [Claude Code](https://code.claude.com), signed in | The plugin runs inside it. |
| A claude.ai account that can publish Artifacts | The study space is an Artifact in your account. Without it the plugin still saves your notes locally, but there is nowhere to study them. |
| Node.js 18 or newer | The hook and the scripts are plain Node, no packages to install. |
| git | Lessons are generated from your commits. |

Works on Windows, macOS and Linux. There are no bash scripts.

## Install

Install it once, for your user, and it works in every repo. This is the default scope.

```
/plugin marketplace add joshrubio/learn-by-doing
/plugin install learn-by-doing@learn-by-doing
```

Restart the session after installing. You do not install it per repo. Instead, it asks you per repo (below).

## Use

1. Work as usual and ask Claude to commit. **The first time in each repo, Claude asks once** whether you want Learn by Doing to learn from it, and remembers the answer. If you say no, the plugin stays silent there. Change it any time with `/learn-repo on|off|status`.
2. In repos you turned on, the plugin saves 1 to 3 lessons per commit (up to 4 for a large one) and adds a single line to Claude's reply, such as "2 lecciones guardadas, 7 pendientes de sincronizar. Ejecuta /study." The count is how many new or edited notes are waiting to reach the study space.
3. Run `/study`. It syncs new and edited notes and your profile to your study space and opens it. The first time it creates the Artifact in your account and tells you that code snippets are uploaded to it.
4. The first time you open the study space it asks how you want to learn (see below). Then study.

To learn from repos you already have:

```
/learn-from-history path/to/repo 8
```

It ranks the repo's past commits by how much they teach, shows you the list and waits for your confirmation before spending anything.

| Command | What it does |
| --- | --- |
| `/study` | Sync new and edited notes and your profile, then open the study space |
| `/learn-repo [on\|off\|status]` | Turn learning on or off for the current repo |
| `/learn-setup` | Choose how you want to learn from the terminal, without opening the study space |
| `/learn-from-history [repo] [max]` | Turn the most instructive past commits into lessons |
| `/learn-project [repo]` | Build a memory of the project and a few base lessons about it |

## Your notes

Every lesson is a Markdown file with frontmatter, one per concept:

```
~/.learn-by-doing/notes/lessons/separation-of-concerns.md
```

```markdown
---
id: separation-of-concerns
type: decision
area: backend
project: my-api
commit: b41c0de
modality: justifica
scope: universal
kind: app
languages: ["typescript"]
frameworks: ["nextjs"]
related: ["layered-architecture"]
appearances: ["other-repo@7d1e0aa@2026-11-08"]
---
# Why the route does not talk to the database directly

## Introducción
- **El proyecto:** ...
- **Dónde está el cambio:** ...
### Mapa
(optional ASCII diagram)
## Contexto
- **Qué se construía:** ...
## Código
## Predice
### Qué ocurre
## Concepto
## Ejercicio
## Relacionado
- [[layered-architecture]]
```

They open in Obsidian or any editor, search with grep and version with git. You can edit or delete them by hand: the next `/study` syncs your edits to the study space. To keep them in an Obsidian vault, point the plugin at it:

```
node <plugin>/scripts/lbd.js config set notesDir "/path/to/vault/learn-by-doing"
```

If the same concept appears in another repo, it is recorded as an appearance inside the same note instead of a duplicate. Notes are the source of truth, and the study space is built from them. Your progress is kept in the study space, not in the notes.

## Project memory and base lessons

Lessons generated one commit at a time can feel random: the hook only sees a patch, so it cannot tell what is central to the project and what is a corner. To fix that, the plugin keeps a short memory of each repo you turn on.

- **`/learn-project`** (or "yes" to the question asked right after you turn a repo on) scans the repo (README, manifests, entry points, folder tree), reads the files that carry the main flow and saves two things. A **memory**: what the project is, where things live, its main flow and the 3 to 8 concepts that matter most in it. And **4 to 6 base lessons**: what it is, how it is laid out, the main flow, the data, how to run and test it, the key decisions. They show up first on the project's card as "Empieza aquí".
- **Every later commit** gets that memory back: the summary and structure place the lesson in the project (they feed the introduction), the core concepts are favored, and the lessons already taught in that repo are listed so they are not repeated.
- **Variety.** The hook also reports how the latest lessons were spread over exercises and types, so the plugin stops defaulting to the same one.
- The memory lives in `~/.learn-by-doing/memory/<repo>.json`, not in the repo. Rebuild it any time with `/learn-project`.

## Kind of project, languages and frameworks

What you need to learn depends on what you are building. A classic app needs the architecture inside its framework, design patterns and infrastructure. A plugin, an MCP server or an integration needs the contract with the other side, and the language weighs less. So every repo gets a **kind**, and every lesson gets tags.

- **Detected, not guessed.** A script reads manifests (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `.claude-plugin/`...) and file extensions, so `node`, `nodejs` and `Node.js` never become three tags. In a monorepo it works per package, and a lesson takes the tags of the package its code belongs to.
- **Kinds** (a closed list): `app`, `libreria`, `plugin`, `mcp`, `integracion`, `script`, `infraestructura`, `otro`.
- **Confirmed once.** The first time in a repo, the activation question tells you the detected kind. You can accept it, say "yes, but it is another kind" and pick one, or say no.
- **Weighted by kind.** The skill favors different lessons for each kind (architecture and patterns for an app, contracts and error handling for a plugin or MCP server).
- **Scope of each concept.** `universal` concepts (separation of concerns) are shared across all your repos. `lenguaje`, `framework` and `tipo` concepts belong to their branch, so knowing `async` in JavaScript does not count as knowing it in Python.

In the study space you can filter lessons by project, kind and language, and the concepts table shows each one's scope.

## The map

Lessons answer "what did I learn in this commit". The map answers "where am I, and what is next". It is built on a catalog of 85 concepts in 15 branches (universal, three languages, four frameworks and seven kinds of project) with the prerequisites between them.

- **Discovered**: a lesson of yours covers it.
- **You know it**: you marked it in the diagnostic. A topic you marked as rusty counts as known and is flagged.
- **Frontier**: you have everything it needs and it belongs to one of your branches. This is what to learn next, and the dashboard suggests it when nothing else is pending.
- **Unexplored**: the rest. Branches your repos do not touch are hidden at first, but you can add any of them.

The map is drawn as a **3D graph**, like Obsidian's graph view: nodes that you can orbit, zoom and click, with the ones you have seen lit up and the unexplored ones dim.

- **Nodes** are concepts, your repos (as larger nodes) and the base lessons of each repo.
- **Links** come in three layers you can switch on and off: prerequisites between concepts, lessons that are related to each other, and the repo each lesson was taught in. A repo pulls its concepts into a cluster, so you can see what each project taught you and where projects overlap.
- **Hover or select** a node and the rest dims, leaving it and its neighbours lit, with their names written next to them. More names appear as you zoom in.
- **Branch chips** choose which branches are drawn. Your own branches are on by default, and "Añadir otra rama" brings in the rest.
- **List view** shows the same concepts as text grouped by state. It is the way in for keyboard and screen-reader users, and it is what you get when the browser cannot do WebGL or the graph library cannot load. The choice between graph and list is remembered.

Pick a concept to see what it is, what you need before it, what it opens the way to and your lessons about it. "Explorar con Claude" explains any concept on demand, even an unexplored one. That uses your own Claude usage and is never run on its own.

Lessons attach to the map by their concept name. The hook tells Claude which catalog ids fit your repo, and English aliases are understood (`separation-of-concerns` lands on `separacion-de-responsabilidades`). A concept outside the catalog still appears, as an extra node in the closest branch. The catalog lives in `scripts/catalog.js`; after editing it run `node scripts/sync-catalog.js` to copy it into the page.

## Every lesson has the same shape

Introduction, context, predict, concept, one exercise, result. Each lesson has its own page.

1. **Introduction.** What the repo is, where in it the change lives and, when the change spans several pieces, a small ASCII map of what was done. It places you in the project before any code, even weeks after the commit. Lessons saved before 0.7.0 have no introduction and simply start at the context.
2. **Context.** What was being built and what you are about to learn.
3. **Predict.** You commit to a guess before reading the explanation. "Comprobar con Claude" tells you how close you were before you see the answer, and the lesson keeps a short "what actually happens" to compare with. It uses your own Claude usage and never runs on its own.
4. **Concept.** A short mental model, not a definition.
5. **Exercise.** Exactly one, always from the kinds you chose.
6. **Result.** Right, partly right or not yet. It feeds the spaced review. "Continuar" takes you back to the lessons.

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
- **Lecciones**: a switch at the side of the title alternates two views, and the study space remembers the last one you used. By lesson, with filters by project, kind, language, area and state, grouped by commit. By project, a vertical stack of cards with the project's kind and languages, its summary, the base lessons ("Empieza aquí"), the core concepts, number of lessons and commits, progress, tags of what you learn in it, its structure and the list of its lessons. Every lesson opens on its own page.
- **Repaso**: spaced review with intervals of 1, 3, 7, 16 and 35 days. A concept you got wrong goes back to the start; a partly right one stays where it is.
- **Conceptos**: everything you have seen, with its state and in how many projects it appeared. A concept has one state, shared by all your projects.
- **Mapa**: a 3D graph of what you have discovered, what is next to it and what is unexplored, with your repos and base lessons as nodes (see "The map" above).
- **Perfil**: your exercise choices, with the button to change them.

States: new, learning, rusty (due for review), mastered.

## How it works

```
git commit by Claude, in any repo
   -> PostToolUse hook (Node) checks the repo's decision
        off       -> silent, no tokens
        undecided -> short message asking Claude to ask you once, no patch
        on        -> commit message, areas, patch, your profile, the repo's kind and
                     detected languages and frameworks, the catalog concepts that fit,
                     and how many notes are waiting to sync
   -> the learn-by-doing skill writes lessons and saves them as notes through the plugin's
      MCP tool save_lessons (no shell commands, no temp files)
/study
   -> pulls your profile from the study space into ~/.learn-by-doing/profile.json
   -> lbd.js sync-plan (new and edited notes, by content hash) -> one batched write
   -> the study space reads lessons live and keeps your progress under your private user path
```

- The skill teaches the why, not the syntax. Lesson types: `concepto`, `decision` (architecture trade-offs), `riesgo`, `lectura`.
- The script rejects any lesson whose exercise is not one of the kinds you enabled.
- Large commits are split by area and only the most valuable lessons are kept.
- Tokens are only spent in repos you turned on, plus one short question the first time in a new repo.

To pause the plugin everywhere, create an empty file `~/.learn-by-doing/off`, or `.learn-off` in a single repo. Set `LBD_HOME` to keep the plugin's data somewhere else.

## Privacy

- Notes are generated and stored on your machine.
- The plugin learns only from repos you said yes to. If a repo belongs to an employer or client, check that it is allowed to upload its code to a service of your own before saying yes.
- Only `/study` uploads lessons, to your own Artifact, which is private by default. Sharing it is up to you from the Artifact's Share menu.
- The skill is instructed to include only the few lines that illustrate a concept, never a whole file or diff, and never secrets, tokens or personal data. That is an instruction to the model, so skim your notes before sharing the Artifact with anyone.
- The project memory (summary, folder structure, main flow) goes to the same Artifact with `/study`. It holds no code, but for a client repo it still describes how the project is built, so the same rule applies.
- Anyone who can open the Artifact can read the lessons and project memories in it.
- When Claude grades an answer, your answer and the lesson text are sent to Claude from your browser, on your own account.

## Known limits

- Only commits Claude makes inside a Claude Code session are noticed. Commits you make by hand are not.
- Tested end to end with Claude Code 2.1.319 in headless mode (`claude -p`): the hook, the activation question, saving notes. Nobody has used it interactively yet, so permission prompts and the question dialog are untested.
- The hook only runs for Bash calls that involve git (it uses the hook `if` filter `Bash(git *)`). This was verified for `git add -A && git commit`, `cd . && git commit` and `git -C . commit`. A commit made through some unusual wrapper might be missed.
- Commits are detected by asking git for a recent, not yet handled `HEAD`, not by reading the command output, so `git commit -q` works.
- The first time Claude uses the plugin's tools in a session, Claude Code asks for permission. Choose "always allow" for the `learn-by-doing` server so later commits do not ask again.
- A profile change reaches the lessons Claude writes after your next `/study`, because the plugin reads the profile then.
- Lesson quality depends on Claude following the skill. The script validates the shape of each lesson, not its content.
- Creating the Artifact the first time and each sync ask for your approval in Claude Code.
- **Syncing is manual.** New lessons reach the study space only when you run `/study`, from any folder: it syncs everything waiting, whichever repo it came from. Opening the study space alone shows what is already synced. Answers and progress are saved live and need no `/study`. The study space cannot sync by itself because a published page could not reach the plugin's local MCP server in the Claude desktop app (tested with Claude 4.23118.0: both the plugin's server and one registered in the user MCP config returned `server_not_connected`). Syncing after every commit would cost extra model calls per commit, so the reminder line is the chosen compromise.
- The desktop app rewrites `~/.claude.json` while it runs and can drop entries added from outside. If you edit your MCP configuration, do it with the app closed.
- Detection relies on manifests and extensions and knows about 35 common frameworks. An unusual layout may come out as `otro` or miss a framework. Correct the kind in the activation question.
- The catalog covers common concepts only. A language or framework that is not in it has no branch yet, so its lessons show up as extra nodes in the universal branch.
- If two concepts mean the same thing under different names, they are kept apart. The skill is told to reuse existing names, which prevents most of it.
- If you edit a note so that it no longer follows the format, the script skips it with a warning instead of syncing it.

- The 3D graph needs WebGL and loads one script (`3d-force-graph`, pinned to a version and checked with an integrity hash) from jsDelivr the first time the map opens. Nothing of yours is sent to it. If it cannot load, the map falls back to the list view.
- The graph only grows interesting with several repos and lessons. With a handful it is a small cluster, and lessons link to each other only through the `related` field and shared repos.

## Ideas for later

- More catalog branches (Go, Rust, Vue, Django, Spring...) and prerequisites you can edit from the study space.
- An "Import notes" button in the study space with a folder picker, so notes can reach it without Claude Code. It would need the sync state to live in the study space's database so the page and `/study` do not clash.
- Export your progress and profile into the notes too.
- Semantic search across notes once a collection is large enough to need it.

## License

MIT
