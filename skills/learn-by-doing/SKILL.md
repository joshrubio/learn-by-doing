---
name: learn-by-doing
description: Turns a git commit into a few short lessons saved for later study. Use when a [learn-by-doing] message reports a commit that was just made, or when the user asks to turn recent work into lessons.
---

# Learn by Doing

Goal: the user is learning to code by working with AI. Most of the code is written by the AI, so what they need to build is the ability to **read, review and decide**, not to write. After each commit, save a few lessons about the code that was actually written, so they can study them later. Never interrupt their work and never teach in chat.

## When it runs

A hook adds a `[learn-by-doing]` message after a commit, with the commit hash, size, changed areas, the learner profile and the patch. Follow it silently, save the lessons, then end your reply with one line in the user's language saying how many lessons were saved and how many are now waiting to sync in total (the hook message gives the count before this commit), and that `/study` syncs them.

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
4. Project relevance. When the hook message gives the project memory, lessons about its core concepts, or about the piece of the structure the commit touches, outrank a detail that lives off the main path.

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

### Concept names and the map

The study space draws a map of what the learner has discovered, what is next to it and what is unexplored. It is built on a catalog of concepts with prerequisites. The hook message lists the catalog ids that fit the repo. When the idea of a lesson matches one of them, use that id as `concept` (for example `separacion-de-responsabilidades`, `js-promesas-y-async-await`, `next-rutas`), so the lesson lands on the right node. If nothing matches, write a new descriptive kebab-case slug; it shows up as an extra node in the closest branch. Never reuse a catalog id for a different idea.

## Every lesson has the same spine

Introduction, context, predict, concept, one exercise, result. The only part that varies is the exercise, and there is exactly one per lesson.

The learner may open a lesson weeks after the commit, so the page starts by placing them in the project before any code.

0. `intro`, required, in the user's language. It is the first thing on the page, above the context:
   - `project`: what the repo is, one or two sentences a stranger would understand ("A booking API for a small clinic, built with Express"). Take it from the README, the manifest or the code, never invent it. Keep it stable across lessons of the same repo.
   - `where`: where the change lives and what it touches, one or two sentences: the folder or layer, its neighbours, who calls it ("It lives in `src/routes`, the layer that receives HTTP requests and hands them to services").
   - `diagram`, optional: a plain-text map, only when the change spans several pieces or a flow and a picture says it faster than words. Boxes and arrows in ASCII, at most 16 lines and 64 columns, no tabs. Mark the part that changed with `<== here`. Leave it out for a change inside one file, never draw a decorative one.

   Example of a diagram:

   ```
   +---------+     +-----------+     +----------+
   | route   | --> | service   | --> | database |
   +---------+     +-----------+     +----------+
                        ^
                        '-- <== here: new validation
   ```

   `intro` is about the whole project and the place of the change. `context`, next, is about the feature of this commit. Do not repeat one in the other.

1. `context`, three short plain-language sentences for someone who has not looked at the commit:
   - `building`: what the commit or feature was building, in product terms, never a restatement of the diff.
   - `snippetRole`: what this snippet does inside that, in one sentence.
   - `learning`: the one concept this lesson teaches, as a promise to the reader.
   The project name is added automatically. The `title` names the concept, not the file.
2. `code`: the user's real code, at most 15 lines, only the lines that illustrate the concept. Never paste the whole diff.
3. `predict`: one short question the learner can answer by thinking, before reading the explanation, and `predictAnswer`: what actually happens, in one or two sentences. The study space lets the learner write a prediction and ask Claude to check it against your `predictAnswer` and the explanation, so the question needs a concrete answer ("what does this return when the list is empty?"), never an opinion.
4. `explain`: the concept in 3 or 4 lines, as a mental model and not a textbook definition.
5. `exercise`: one exercise, chosen as below.

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

## Using the project memory

When the hook message has a "Project memory" block, the repo was studied once and the plugin remembers what it is. Use it:
- Take `intro.project` from the summary, word for word or lightly shortened, so every lesson of the repo introduces it the same way.
- Take `intro.where` from the structure: name the piece the commit touches and what is next to it.
- Favor the core concepts it lists. A commit that touches the main flow deserves a lesson even when it is small. A commit that only polishes a corner does not.
- Do not teach again an idea in "Already taught in this repo". Teach a clearly different side of it or pick something else.

When the hook message has no memory, work as before from the patch alone.

## Variety

The hook message may list how the latest lessons were spread over exercises and types. Fit still comes first, but when two exercises fit about equally, pick the one used least lately, and never the same one three times in a row. Do not default to one exercise for a type: a reading lesson can end in a multiple choice, a decision in a comparison, a concept in a free recall. If none of the latest lessons was a `concepto` and the commit shows a new idea, write one.

## Project primer

A primer is a short, first course about one repo, written before its commits start to teach: a memory of the project plus 4 to 6 base lessons. It runs from `/learn-project`, or when the user says yes to the question the hook asks right after they turn a repo on. Never start one on your own.

1. Call `scan_project` with the repo path. It returns the README excerpt, manifests, entry points, folder tree and recent commits.
2. Read the files that carry the main flow: the README if the excerpt was cut, the entry points and 3 to 6 more. Do not read the whole repo.
3. Call `save_project_memory` with:
   - `summary`: what the project is and who it is for, in the user's language, at most 500 characters.
   - `structure`: 3 to 12 pieces, each with a `path` and a `role` ("src/routes: receives HTTP requests and hands them to services").
   - `flow`: the main flow in one or two sentences.
   - `core`: 3 to 8 concept slugs that matter most in this project. Use catalog ids when one fits.
   - `diagram`: optional ASCII map of the pieces, same limits as a lesson diagram.
   - `commit`: the short hash of HEAD.
4. Call `save_lessons` with `commit: { "hash": "base", "message": "Panorama del proyecto" }`, up to 6 lessons, each with `"primer": true` and `"order"` from 1. Every concept slug must start with the project slug and a dash, because these lessons belong to one repo (for example `my-api-panorama`). Pick from this list what the project actually has, in this order:
   1. `<slug>-panorama`: what the project is, who uses it, what problem it solves. Include a diagram.
   2. `<slug>-estructura`: where things live and why they are separated.
   3. `<slug>-flujo-principal`: follow the main flow from input to output through the real files.
   4. `<slug>-datos`: how data or state is modelled and stored. Skip if there is none.
   5. `<slug>-ejecutar-y-probar`: how it is run, tested and deployed. Skip if the repo shows nothing about it.
   6. `<slug>-decisiones`: one or two choices that shape the project and the alternative that was not taken.
   Base lessons use real code of at most 15 lines from the files you read, an `intro` like any other lesson (the same `project` as the memory), a `predict` with its `predictAnswer`, and one exercise from the allowed ones. Spread the exercises: do not give all of them the same.
5. Do not explain the primer in chat. The command or hook says what to reply.

A rebuild refreshes the memory. Base lessons whose concept already exists are not written again.

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
      "intro": {
        "project": "A booking API for a small clinic, built with Express.",
        "where": "It lives in src/routes, the layer that receives HTTP requests and hands them to services.",
        "diagram": "+--------+     +---------+     +----+
| route  | --> | service | --> | db |
+--------+     +---------+     +----+
    ^
    <== here"
      },
      "context": {
        "building": "A login endpoint so users can sign in with email and password.",
        "snippetRole": "This is the route that receives the login request and answers with the user or an error.",
        "learning": "Why a route should hand work to a service instead of querying the database itself."
      },
      "code": { "file": "src/routes/login.js", "text": "..." },
      "predict": "What would you have to change if the users moved to another database?",
      "predictAnswer": "Every route that queries the database directly, one by one. With a service in between, only the service changes.",
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

`related` lists 1 to 3 other concepts this one connects to, as slugs (catalog ids when one fits). The study space draws them as links in its 3D map, so name real neighbours, not everything you can think of.

`area` is one of: frontend, backend, base-de-datos, tests, config, codigo, docs, otros. `concept` is a short kebab-case slug, stable across commits and projects so repeats are detected. For a commit from the past (history mode) add `"date": "YYYY-MM-DD"` to `commit`. The tool rejects invalid lessons and returns why, fix and call it again.

Each lesson becomes a note file. If the concept already has a note, the script records the new project and commit as an appearance inside the existing note instead of creating a duplicate. Saved lessons wait locally until the user runs `/study`, which syncs new and edited notes to the study space in one batch. Never call the Artifact or ArtifactData tools from a commit hook turn.

## Privacy

Lessons live in `~/.learn-by-doing/` on the user's machine. Only `/study` uploads them, to the user's own private Artifact. Show only the lines that illustrate the concept, never a whole file or diff. Do not include secrets, tokens, internal URLs or personal data in any field. The same goes for the project memory: it is uploaded to the study space too, so write what the project is and how it is laid out, never credentials, internal hostnames or customer data.
