#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const shared = require(path.join(__dirname, '..', 'scripts', 'shared.js'));
const detector = require(path.join(__dirname, '..', 'scripts', 'detect.js'));
const catalog = require(path.join(__dirname, '..', 'scripts', 'catalog.js'));

const COMMIT_CMD = /\bgit\s+(?:-C\s+\S+\s+|-c\s+\S+\s+)*commit\b/;
const FRESH_SECONDS = 300;
const DETECT_TTL_MS = 86400000;
const AREAS = [
  ['tests', /(^|\/)(tests?|__tests__|spec|e2e)\/|\.(test|spec)\.[a-z]+$/i],
  ['base-de-datos', /(^|\/)(migrations?|prisma|db|database|schema)\/|\.sql$/i],
  ['frontend', /(^|\/)(frontend|client|web|ui|components?|pages|views|styles?|public)\/|\.(tsx|jsx|vue|svelte|css|scss|html)$/i],
  ['backend', /(^|\/)(backend|server|api|routes?|controllers?|services?|models?|handlers?)\/|\.(py|go|rs|java|rb|php|cs)$/i],
  ['config', /(^|\/)(\.github|\.vscode|docker|config)\/|(^|\/)(package\.json|tsconfig\.json|Dockerfile|docker-compose\.ya?ml|\.env[^/]*|\.gitignore|[^/]+\.config\.[a-z]+)$/i],
  ['docs', /\.(md|mdx|txt|rst)$/i],
];
const LOW_SIGNAL = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|Cargo\.lock|poetry\.lock|dist|build|node_modules|\.next)(\/|$)|\.(min\.js|map|svg|png|jpe?g|gif|ico|woff2?)$/i;
const MAX_PATCH = 14000;

function areaOf(file) {
  for (const [name, re] of AREAS) if (re.test(file)) return name;
  return /\.(js|ts|mjs|cjs)$/i.test(file) ? 'codigo' : 'otros';
}

/* Notes that are new or edited since the last sync. Cheap: a few small files. */
function pendingNotes() {
  try {
    const notes = require(path.join(__dirname, '..', 'scripts', 'notes.js'));
    const dir = shared.lessonsDir();
    const sync = shared.readState().sync || {};
    let n = 0;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.md')) continue;
      const text = fs.readFileSync(path.join(dir, f), 'utf8');
      const id = notes.splitFrontmatter(text).data.id;
      if (!id || !sync[id] || sync[id].hash !== notes.hashOf(text)) n++;
    }
    return n;
  } catch { return 0; }
}

/* Lessons already written, newest first. Read only to give Claude some memory of what was taught. */
function savedLessons() {
  try {
    const notes = require(path.join(__dirname, '..', 'scripts', 'notes.js'));
    const dir = shared.lessonsDir();
    const all = [];
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.md')) continue;
      const r = notes.markdownToLesson(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (r.lesson && r.lesson.id) all.push(r.lesson);
    }
    return all.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  } catch { return []; }
}

const tally = (items) => Object.entries(items.reduce((m, x) => ((m[x] = (m[x] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);

/* Without this, every commit is judged alone and the model keeps choosing the same kind of lesson. */
function varietyLines(all, enabled) {
  const recent = all.slice(0, 8);
  if (recent.length < 3) return [];
  const used = tally(recent.map((l) => l.exercise && l.exercise.modality).filter(Boolean));
  const types = tally(recent.map((l) => l.type).filter(Boolean));
  const unused = enabled.filter((m) => !used.some(([u]) => u === m));
  const lastThree = recent.slice(0, 3).map((l) => l.exercise && l.exercise.modality);
  const lines = [
    `Variety. Last ${recent.length} lessons by exercise: ${used.map(([m, n]) => `${m} x${n}`).join(', ')}. By type: ${types.map(([t, n]) => `${t} x${n}`).join(', ')}.`,
    'Fit still comes first, but when two exercises fit about equally pick the one used least lately. Do not use the same exercise three times in a row.',
  ];
  if (unused.length) lines.push(`Enabled and not used lately: ${unused.join(', ')}.`);
  if (lastThree[0] && lastThree.every((m) => m === lastThree[0])) lines.push(`The last three lessons all used "${lastThree[0]}", so this time use a different one.`);
  if (!recent.slice(0, 5).some((l) => l.type === 'concepto')) lines.push('No "concepto" lesson lately: if the commit shows a new idea, a concept lesson is welcome.');
  return lines;
}

function memoryLines(mem, taught) {
  const lines = [
    `Project memory${mem.builtAtCommit ? ` (built at ${mem.builtAtCommit})` : ''}. Use it to place each lesson: take intro.project from the summary and intro.where from the structure.`,
    `Summary: ${mem.summary}`,
    'Structure:',
    ...(mem.structure || []).map((s) => `- ${s.path}: ${s.role}`),
  ];
  if (mem.flow) lines.push(`Main flow: ${mem.flow}`);
  if (mem.core && mem.core.length) lines.push(`Core concepts of this project, favor lessons that teach them or build on them: ${mem.core.join(', ')}. A lesson about a minor detail off that path should lose to one on it.`);
  if (taught.length) lines.push(`Already taught in this repo, do not repeat the idea: ${taught.slice(0, 12).map((l) => `"${l.title}" (${l.id})`).join('; ')}.`);
  return lines;
}

const NO_MEMORY_HINT = 'This repo has no project memory yet. At the end of your reply add one extra short line, in the user\'s language, suggesting /learn-project: it builds a few base lessons about the project and a memory of its structure that makes every later lesson more relevant. Say it only this once.';

const out = (context) => process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: context } }));
const fwd = (p) => p.replace(/\\/g, '/');
const list = (a) => (a && a.length ? a.join(', ') : 'none');

function detectedLine(det, kind, source) {
  const lines = [`Project kind: ${kind} (${source}). Languages: ${list(det && det.languages)}. Frameworks: ${list(det && det.frameworks)}.`];
  if (det && det.monorepo) {
    lines.push('Monorepo packages: ' + det.packages.map((p) => `${p.path || '.'} (${p.kind}; ${list(p.languages)}; ${list(p.frameworks)})`).join(' | '));
  }
  return lines.join('\n');
}

function askMessage(proj, cwd, hash, message, det) {
  const kind = (det && det.kind) || 'otro';
  const why = det && det.reasons && det.reasons.length ? ` because ${det.reasons.join(', ')}` : '';
  return [
    `[learn-by-doing] A commit was just made in a repo the user has not decided about yet: ${proj.name} (${hash} "${message}").`,
    `Detected: kind "${kind}"${why}. Languages: ${list(det && det.languages)}. Frameworks: ${list(det && det.frameworks)}.`,
    'Do not write any lessons yet. Ask the user once, in their language, with the AskUserQuestion tool:',
    `"¿Quieres que Learn by Doing aprenda de los commits de ${proj.name}? Lo he detectado como: ${kind}." with three options: "Sí, en este repo (${kind})", "Sí, pero es otro tipo de proyecto", "No, nunca aquí".`,
    'Tell them in one sentence that lessons are generated from the code of each commit and, when they run /study, snippets are uploaded to their own private study space. If this repo belongs to an employer or client, they should check that this is allowed.',
    `Then call the set_repo tool of the learn-by-doing MCP server with project "${fwd(cwd)}":`,
    '- first option: enabled true, no kind (the detected one stays and keeps updating);',
    '- second option: ask one more AskUserQuestion with the 3 or 4 most plausible other kinds for this repo, chosen from app, libreria, plugin, mcp, integracion, script, infraestructura, otro (the user can type another with "Other"), then enabled true and kind set to their answer;',
    '- third option: enabled false.',
    `After enabling (first or second option) ask once more with AskUserQuestion: "¿Quieres que haga ahora un panorama de ${proj.name}? Son unas 4 o 5 lecciones base y una memoria de su estructura, y gasta algo de tu uso de Claude." with two options: "Sí, ahora" and "Más tarde (/learn-project)". If they say yes, follow the "Project primer" section of the learn-by-doing skill for project "${fwd(cwd)}" first. If they say later, skip it.`,
    `If they said yes to learning here, then read this commit with: git -C "${fwd(cwd)}" show ${hash}   and continue as the learn-by-doing skill describes, saving the lessons now. If they said no, say nothing more about it.`,
  ].join('\n');
}

function main(raw) {
  let input;
  try { input = JSON.parse(raw); } catch { return; }
  if (input.tool_name !== 'Bash') return;
  const command = (input.tool_input && input.tool_input.command) || '';
  if (!COMMIT_CMD.test(command)) return;

  const cwd = input.cwd || process.cwd();
  if (fs.existsSync(path.join(shared.home(), 'off')) || fs.existsSync(path.join(cwd, '.learn-off'))) return;

  const lbd = fwd(path.join(__dirname, '..', 'scripts', 'lbd.js'));
  const proj = shared.identify(cwd);
  const state = shared.readState();
  const entry = state.projects[proj.slug];
  if (entry && entry.learn === false) return;

  /* The command's output is not a reliable sign of a commit (git commit -q prints nothing),
     so ask git: HEAD must be recent and not the one already handled. */
  let full, hash, message, committedAt;
  try {
    full = shared.git(cwd, ['rev-parse', 'HEAD']).trim();
    hash = shared.git(cwd, ['rev-parse', '--short', 'HEAD']).trim();
    message = shared.git(cwd, ['log', '-1', '--format=%s']).trim();
    committedAt = Number(shared.git(cwd, ['log', '-1', '--format=%ct']).trim());
  } catch { return; }
  if (!committedAt || Date.now() / 1000 - committedAt > FRESH_SECONDS) return;
  if (entry && entry.lastHash === full) return;

  let det = entry && entry.detected && entry.detected.detectedAt && Date.now() - Date.parse(entry.detected.detectedAt) < DETECT_TTL_MS ? entry.detected : null;
  if (!det) { try { det = detector.detect(cwd); } catch { det = entry && entry.detected; } }
  const now = new Date().toISOString();
  state.projects[proj.slug] = { ...(entry || {}), name: proj.name, path: proj.dir, remote: proj.remote, firstSeen: (entry && entry.firstSeen) || now, lastSeen: now, lastHash: full, detected: det };
  shared.writeState(state);

  if (!entry || entry.learn !== true) return out(askMessage(proj, cwd, hash, message, det));

  const kind = entry.kindOverride || (det && det.kind) || 'otro';
  const kindSource = entry.kindOverride ? 'set by the user' : 'detected';

  let numstat, patch;
  try {
    numstat = shared.git(cwd, ['show', 'HEAD', '--numstat', '--format=']).trim().split('\n').filter(Boolean);
    patch = shared.git(cwd, ['show', 'HEAD', '--format=', '--unified=2', '--no-color']);
  } catch { return; }

  const files = numstat.map((l) => {
    const [add, del, ...rest] = l.split('\t');
    const file = rest.join('\t');
    return { file, add: Number(add) || 0, del: Number(del) || 0, area: areaOf(file), low: LOW_SIGNAL.test(file) };
  });
  const useful = files.filter((f) => !f.low);
  if (useful.length === 0) return;

  const lines = useful.reduce((n, f) => n + f.add + f.del, 0);
  const byArea = {};
  for (const f of useful) (byArea[f.area] = byArea[f.area] || []).push(f);
  const large = useful.length > 15 || lines > 600 || Object.keys(byArea).length > 3;

  const areaList = Object.entries(byArea)
    .map(([a, fs_]) => `- ${a}: ${fs_.length} file(s), ${fs_.reduce((n, f) => n + f.add + f.del, 0)} line(s) changed (${fs_.slice(0, 6).map((f) => f.file).join(', ')}${fs_.length > 6 ? ', ...' : ''})`)
    .join('\n');

  patch = patch
    .split(/^(?=diff --git )/m)
    .filter((chunk) => {
      const m = chunk.match(/^diff --git a\/(.+?) b\//);
      return !m || !LOW_SIGNAL.test(m[1]);
    })
    .join('');
  const patchText = patch.length > MAX_PATCH ? patch.slice(0, MAX_PATCH) + '\n... [patch truncated, use git show for the rest]' : patch;

  const p = shared.readProfile();
  const profileLines = [
    `Learner profile${p.isDefault ? ' (no profile set yet, defaults)' : ''}: allowed exercise modalities = ${p.modalities.join(', ')}.`,
    p.level ? `Level: ${p.level}.` : '',
    p.known.length ? `Known concepts, skip them: ${p.known.join(', ')}.` : '',
    p.rusty.length ? `Rusty concepts, teach as a short refresher: ${p.rusty.join(', ')}.` : '',
  ].filter(Boolean);

  const saved = savedLessons();
  const mem = shared.readMemory(proj.slug);
  let projectLines = [];
  if (mem) projectLines = memoryLines(mem, saved.filter((l) => l.project === proj.slug));
  else if (!entry.memoryHinted) {
    projectLines = [NO_MEMORY_HINT];
    state.projects[proj.slug].memoryHinted = true;
    shared.writeState(state);
  }

  out([
    `[learn-by-doing] A commit was just made: ${hash} "${message}".`,
    ...profileLines,
    detectedLine(det, kind, kindSource),
    ...projectLines,
    ...varietyLines(saved, p.modalities),
    `For a ${kind} project, favor lessons about: ${shared.KIND_FOCUS[kind] || shared.KIND_FOCUS.otro}`,
    'Every lesson needs a "scope": universal (any language), lenguaje (tied to a language), framework (tied to a framework) or tipo (tied to this kind of project). Languages and frameworks are filled in automatically from the package of the lesson\'s code.file, so do not invent them. If you set them, they must come from the lists above.',
    `Concepts in the catalog that the study-space map is built on. When the idea of a lesson matches one, use its id as the lesson's "concept"; otherwise write a new descriptive kebab-case slug: ${catalog.slugsFor(det, kind).join(', ')}.`,
    `Size: ${useful.length} file(s), ${lines} line(s) changed${large ? ' -> LARGE commit, apply the large-commit rule' : ''}.`,
    'Changed areas:',
    areaList,
    '',
    'Follow the learn-by-doing skill now, silently, without interrupting the user: pick the lessons worth teaching from this commit and save them with the save_lessons tool of the learn-by-doing MCP server, using:',
    `  project: "${fwd(cwd)}"   commit: { "hash": "${hash}", "message": ${JSON.stringify(message)} }`,
    `Notes waiting to be synced before this commit: ${pendingNotes()}. After saving, end your reply with one short line in the user's language: how many lessons this commit added and the new total waiting to sync (the number above plus the lessons actually saved; a concept that already had a note adds none), and that /study syncs them. Example: "2 lecciones guardadas, 7 pendientes de sincronizar. Ejecuta /study." Do not explain the lessons in chat.`,
    '',
    '--- patch ---',
    patchText,
  ].join('\n'));
}

let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (data += c));
process.stdin.on('end', () => main(data));
