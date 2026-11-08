---
name: learn-by-doing
description: Turns a git commit into a few short lessons saved for later study. Use when a [learn-by-doing] message reports a commit that was just made, or when the user asks to turn recent work into lessons.
---

# Learn by Doing

Goal: the user is learning to code by working with AI. Most of the code is written by the AI, so what they need to build is the ability to **read, review and decide**, not to write. After each commit, save a few lessons about the code that was actually written, so they can study them later. Never interrupt their work and never teach in chat.

## When it runs

A hook adds a `[learn-by-doing]` message after a commit, with the commit hash, size, changed areas, the learner profile and the patch. Follow it silently, save the lessons, then end your reply with one line saying how many were saved and that `/study` opens them.

## Where things live

Lessons are Markdown notes with frontmatter, one file per concept, in `~/.learn-by-doing/notes/lessons/<concept>.md` (the folder can be moved with `config set notesDir <path>`, for example into an Obsidian vault). They are shared by all projects, so concepts carry across repos. The user may edit or delete notes by hand. The study space is an Artifact that `/study` creates and syncs from the notes. Never write the note files yourself, always go through the `save_lessons` tool, which validates them.

## Repos the user has not decided about

The plugin only learns from repos the user turned on. When a hook message says the repo has not been decided yet, it asks you to ask the user once and then call the `set_repo` tool. Follow that message exactly and write no lessons until the user says yes. Never enable a repo on your own, never ask again for a repo that was disabled, and never write lessons for one. The user can change it later with `/learn-repo`.

## The learner profile

The hook message lists the profile. Respect it:
- **Allowed exercise modalities.** Use only these. The script rejects any other.
- **Known concepts.** Skip them.
- **Rusty concepts.** If the code uses one, make it a short refresher lesson, not a full one.
- **Level.** Match depth to it: basico, medio or avanzado.

Call the `list_concepts` tool of the learn-by-doing MCP server first to see every concept already saved, across all projects. Reuse an existing slug when the idea is the same, even if the wording differs, so the app can show it as a repeat appearance. Do not write a new lesson for a concept that is already there, unless the new code shows a clearly different side of it.

## What to teach

Teach the why, not the syntax. Pick at most 3 lessons per commit (1 or 2 for a small one). Rank candidates by:
1. New for this user. Skip what they clearly know.
2. Leverage. Concepts that appear everywhere (state, async, validation, separation of concerns, error handling, paradigms such as functional or object-oriented) beat a library detail.
3. Risk. A bug, a security hole or an edge case the change avoids or introduces goes up.

Skip formatting, renames, dependency bumps, generated files and trivial config.

## Lesson types

The type is about the content. Choose it from what the commit contains, not one type for the whole project.

| type | teaches |
| --- | --- |
| `concepto` | what it is and why it appears here |
| `decision` | the alternative that was not chosen and the trade-off, plus where the piece lives, what it is responsible for, and why it is separate |
| `riesgo` | a bug, security issue or edge case |
| `lectura` | how to follow the flow from input to output |

## Scope and project kind

The hook message gives the project kind (app, libreria, plugin, mcp, integracion, script, infraestructura or otro), its languages and frameworks, and what to favor for that kind. Use it to choose and weigh lessons:
- In an **app**, architecture inside the framework, design patterns, data flow and infrastructure weigh most.
- In a **plugin**, an **mcp** or an **integracion**, the contract with the other side (manifest, tool schemas, protocol, authentication, error handling) weighs most and the language is secondary. Write a lesson about the language only when it is essential to understand the code.
- In a **libreria**, public API design and testing. In a **script**, language fundamentals. In **infraestructura**, configuration, environments and secrets.

Every lesson needs a `scope`, which says where the concept lives:
- `universal`: true in any language or framework (separation of concerns, validation, error handling).
- `lenguaje`: tied to a language (async/await in JavaScript, borrowing in Rust).
- `framework`: tied to a framework (React hooks, Express middleware).
- `tipo`: tied to the kind of project (a plugin manifest, an MCP tool schema).

Do not write languages, frameworks or the project kind yourself. The tool derives them from the package the lesson's `code.file` belongs to, so names never drift. If you do set `languages` or `frameworks`, they must come from the lists in the hook message. In a monorepo, choose `code.file` from the package the lesson is about.

## Every lesson has the same spine

Context, predict, concept, one exercise, result. The only part that varies is the exercise, and there is exactly one per lesson.

0. `context`, three short plain-language sentences for someone who has not looked at the commit:
   - `building`: what the commit or feature was building, in product terms, never a restatement of the diff.
   - `snippetRole`: what this snippet does inside that, in one sentence.
   - `learning`: the one concept this lesson teaches, as a promise to the reader.
   The project name is added automatically. The `title` names the concept, not the file.
1. `code`: the user's real code, at most 15 lines, only the lines that illustrate the concept. Never paste the whole diff.
2. `predict`: one short question to think about before reading the explanation.
3. `explain`: the concept in 3 or 4 lines, as a mental model and not a textbook definition.
4. `exercise`: one exercise, chosen as below.

## Choosing the exercise

Pick from the allowed modalities the one that best fits the lesson type. Never invent a modality, never combine two.

| modality | family | shape | fits best | what the learner does |
| --- | --- | --- | --- | --- |
| `opcion-multiple` | recordar | choice | concepto | picks the right answer among plausible mistakes |
| `recuerdo-libre` | recordar | open | any, mostly repasos | answers from memory, no options on screen |
| `explica` | explicar | open | concepto | explains the concept in their own words |
| `justifica` | explicar | open | decision | defends why the code is built this way, for a stated situation |
| `compara` | explicar | open | decision | chooses between two designs and gives a reason |
| `predice-salida` | leer | choice | lectura | reads a snippet and says what it returns or does |
| `encuentra-error` | leer | choice | riesgo | reads a snippet and points at what is wrong |
| `revisa-cambio` | leer | open | riesgo, decision | reads a change and decides whether to accept it, with reasons |

If the best fit is not allowed, use the closest allowed one. Exercises about reading never ask the learner to write code.

### Exercise fields

Always: `modality`, `prompt` (what the learner must do or answer, self-contained).
When the modality needs code (`predice-salida`, `encuentra-error`, `revisa-cambio`, `compara`): `code` with `text` of at most 20 lines. It may be a small variant of the real code, for example with a planted flaw. Say so in the prompt when it is not verbatim.

Choice modalities add `options` (2 to 5, plausible wrong ones, right answer in a varied position, never always first), `answer` (index) and `why`.
Open modalities add `keyPoints` (2 to 5 short statements a good answer covers, used to grade) and `modelAnswer` (a short reference answer in 2 to 4 sentences).

## Large commits

If the hook says LARGE, do not summarize the whole commit. Split by area, take the most valuable lesson from each of the 2 or 3 most important areas, and ignore the rest. Never exceed 4 lessons. Mention in your reply that the commit was large and only part of it became lessons.

## Saving

Call the `save_lessons` tool of the learn-by-doing MCP server. Never use shell commands, heredocs or temp files for this. The arguments are `project` (the repo path, given in the hook message), `commit` and `lessons`:

```json
{
  "project": "<absolute path of the repo>",
  "commit": { "hash": "abc1234", "message": "add login route" },
  "lessons": [
    {
      "type": "decision",
      "area": "backend",
      "concept": "separation-of-concerns",
      "scope": "universal",
      "title": "Why the route does not talk to the database directly",
      "context": {
        "building": "A login endpoint so users can sign in with email and password.",
        "snippetRole": "This is the route that receives the login request and answers with the user or an error.",
        "learning": "Why a route should hand work to a service instead of querying the database itself."
      },
      "code": { "file": "src/routes/login.js", "text": "..." },
      "predict": "What would you have to change if the users moved to another database?",
      "explain": "...",
      "exercise": {
        "modality": "justifica",
        "prompt": "A teammate wants to query the database straight from the route to save a file. Explain why you would keep the service, and when you would accept their idea.",
        "keyPoints": ["Each layer has one responsibility", "Changing storage should not touch the route", "Skipping the layer can be fine for a throwaway script"],
        "modelAnswer": "..."
      },
      "related": ["layered-architecture"]
    }
  ]
}
```

`area` is one of: frontend, backend, base-de-datos, tests, config, codigo, docs, otros. `concept` is a short kebab-case slug, stable across commits and projects so repeats are detected. For a commit from the past (history mode) add `"date": "YYYY-MM-DD"` to `commit`. The tool rejects invalid lessons and returns why, fix and call it again.

Each lesson becomes a note file. If the concept already has a note, the script records the new project and commit as an appearance inside the existing note instead of creating a duplicate. Saved lessons wait locally until the user runs `/study`, which syncs new and edited notes to the study space in one batch. Never call the Artifact or ArtifactData tools from a commit hook turn.

## Privacy

Lessons live in `~/.learn-by-doing/` on the user's machine. Only `/study` uploads them, to the user's own private Artifact. Show only the lines that illustrate the concept, never a whole file or diff. Do not include secrets, tokens, internal URLs or personal data in any field.
