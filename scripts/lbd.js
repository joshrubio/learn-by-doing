#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const S = require('./shared');
const N = require('./notes');

const { MODALITIES } = S;
const TYPES = ['concepto', 'decision', 'riesgo', 'lectura'];
const AREAS = ['frontend', 'backend', 'base-de-datos', 'tests', 'config', 'codigo', 'docs', 'otros'];
const MAX_PER_COMMIT = 4;
const BATCH = 40;
const LOW_SIGNAL = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|Cargo\.lock|poetry\.lock|dist|build|node_modules|\.next)(\/|$)|\.(min\.js|map|svg|png|jpe?g|gif|ico|woff2?)$/i;

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i > -1 ? argv[i + 1] : undefined;
};
const project = path.resolve(flag('project') || process.env.LBD_PROJECT || process.cwd());
const outbox = () => path.join(S.home(), 'outbox');
const str = (v) => typeof v === 'string' && v.trim().length > 0;
const fail = (msg) => { console.error(`lbd: ${msg}`); process.exit(1); };

function readStdin() {
  return new Promise((resolve) => {
    let d = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (d += c));
    process.stdin.on('end', () => resolve(d));
  });
}

/* ---------- reading notes ---------- */
function allLessons({ warn = true } = {}) {
  const dir = S.lessonsDir();
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')); } catch { return []; }
  const out = [];
  for (const f of files) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    const r = N.markdownToLesson(text);
    if (r.error || !r.lesson.id) { if (warn) console.error(`lbd: skipped ${f}: ${r.error || 'missing id in frontmatter'}`); continue; }
    out.push({ ...r.lesson, file: path.join(dir, f), hash: N.hashOf(text) });
  }
  return out;
}

/* ---------- validation ---------- */
function validate(l, i) {
  const errs = [];
  if (!TYPES.includes(l.type)) errs.push(`type must be one of ${TYPES.join(', ')}`);
  if (!AREAS.includes(l.area)) errs.push(`area must be one of ${AREAS.join(', ')}`);
  if (!str(l.concept) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(l.concept)) errs.push('concept must be a kebab-case slug');
  for (const k of ['title', 'predict', 'explain']) if (!str(l[k])) errs.push(`${k} is required`);
  const x = l.context;
  if (!x || !str(x.building) || !str(x.snippetRole) || !str(x.learning)) errs.push('context.building, context.snippetRole and context.learning are required');
  if (!l.code || !str(l.code.text)) errs.push('code.text is required');
  else if (l.code.text.split('\n').length > 20) errs.push('code.text is longer than 20 lines, keep only the lines that matter');
  errs.push(...validateExercise(l.exercise));
  return errs.length ? `lesson ${i + 1}: ${errs.join('; ')}` : null;
}

function validateExercise(e) {
  if (!e || typeof e !== 'object') return ['exercise is required'];
  const meta = MODALITIES[e.modality];
  if (!meta) return [`exercise.modality must be one of ${Object.keys(MODALITIES).join(', ')}`];
  const profile = S.readProfile();
  if (!profile.modalities.includes(e.modality)) return [`exercise.modality "${e.modality}" is not enabled for this user. Enabled: ${profile.modalities.join(', ')}`];
  const errs = [];
  if (!str(e.prompt)) errs.push('exercise.prompt is required');
  if (e.code !== undefined && !(e.code && str(e.code.text) && e.code.text.split('\n').length <= 20)) errs.push('exercise.code.text must be 1 to 20 lines when present');
  if (['predice-salida', 'encuentra-error', 'revisa-cambio', 'compara'].includes(e.modality) && !(e.code && str(e.code.text))) errs.push(`exercise.code is required for ${e.modality}`);
  if (meta.kind === 'choice') {
    if (!Array.isArray(e.options) || e.options.length < 2 || e.options.length > 5 || !e.options.every(str)) errs.push('exercise.options must be 2 to 5 non-empty strings');
    else if (!Number.isInteger(e.answer) || e.answer < 0 || e.answer >= e.options.length) errs.push('exercise.answer must be a valid option index');
    if (!str(e.why)) errs.push('exercise.why is required');
  } else {
    if (!Array.isArray(e.keyPoints) || e.keyPoints.length < 2 || e.keyPoints.length > 5 || !e.keyPoints.every(str)) errs.push('exercise.keyPoints must be 2 to 5 non-empty strings');
    if (!str(e.modelAnswer)) errs.push('exercise.modelAnswer is required');
  }
  return errs;
}

function cleanExercise(e) {
  const out = { modality: e.modality, prompt: e.prompt };
  if (e.code) out.code = { file: (e.code.file || '').toString(), text: e.code.text };
  if (MODALITIES[e.modality].kind === 'choice') Object.assign(out, { options: e.options, answer: e.answer, why: e.why });
  else Object.assign(out, { keyPoints: e.keyPoints, modelAnswer: e.modelAnswer });
  return out;
}

/* ---------- commands ---------- */
async function add() {
  let input;
  try { input = JSON.parse(await readStdin()); } catch { fail('stdin is not valid JSON'); }
  const lessons = Array.isArray(input.lessons) ? input.lessons : [];
  if (lessons.length === 0) fail('no lessons given');
  if (lessons.length > MAX_PER_COMMIT) fail(`at most ${MAX_PER_COMMIT} lessons per commit, got ${lessons.length}. Keep the most valuable ones`);
  const problems = lessons.map(validate).filter(Boolean);
  if (problems.length) fail(problems.join('\n'));

  const state = S.readState();
  const proj = S.identify(project);
  const known = state.projects[proj.slug] || {};
  if (known.learn === false) fail(`learning is turned off for ${proj.name}. Run "repo enable" only if the user asks for it`);
  const now = new Date().toISOString();
  state.projects[proj.slug] = { ...known, name: proj.name, path: proj.dir, remote: proj.remote, firstSeen: known.firstSeen || now, lastSeen: now };

  const commit = input.commit || {};
  const dir = S.lessonsDir();
  fs.mkdirSync(dir, { recursive: true });
  let added = 0, repeated = 0;
  for (const l of lessons) {
    const file = path.join(dir, `${l.concept}.md`);
    if (fs.existsSync(file)) {
      const text = fs.readFileSync(file, 'utf8');
      const { data, body } = N.splitFrontmatter(text);
      const key = `${proj.slug}@${commit.hash || 'none'}@${(commit.date || now).slice(0, 10)}`;
      const list = Array.isArray(data.appearances) ? data.appearances : [];
      const dup = list.some((a) => a.split('@').slice(0, 2).join('@') === `${proj.slug}@${commit.hash || 'none'}`) || (data.project === proj.slug && data.commit === commit.hash);
      if (!dup) fs.writeFileSync(file, N.joinFrontmatter({ ...data, appearances: [...list, key] }, body));
      repeated++;
      continue;
    }
    fs.writeFileSync(file, N.lessonToMarkdown({
      id: l.concept, createdAt: now, project: proj.slug, projectName: proj.name,
      commit: { hash: commit.hash || '', message: commit.message || '', date: commit.date || '' },
      context: l.context, type: l.type, area: l.area, title: l.title, code: { file: (l.code.file || '').toString(), text: l.code.text },
      predict: l.predict, explain: l.explain, exercise: cleanExercise(l.exercise),
      related: Array.isArray(l.related) ? l.related.filter(str) : [], appearances: [], example: l.example === true,
    }));
    added++;
  }
  S.writeState(state);
  console.log(`saved ${added} new lesson(s), ${repeated} repeated concept(s) recorded as appearances. Project: ${proj.slug}. Notes: ${dir.replace(/\\/g, '/')}`);
}

function list() {
  const all = allLessons();
  if (all.length === 0) return console.log('no lessons yet');
  for (const l of all) console.log(`${l.id}\t${l.type}\t${l.area}\t${l.project}\t${l.commit.hash}\t${l.title}`);
}

function repo() {
  const action = argv[1];
  const proj = S.identify(project);
  const state = S.readState();
  const now = new Date().toISOString();
  if (action === 'enable' || action === 'disable') {
    const known = state.projects[proj.slug] || {};
    state.projects[proj.slug] = { ...known, name: proj.name, path: proj.dir, remote: proj.remote, firstSeen: known.firstSeen || now, lastSeen: now, learn: action === 'enable' };
    S.writeState(state);
  } else if (action !== 'status') fail('usage: repo status|enable|disable [--project dir]');
  const entry = state.projects[proj.slug];
  console.log(JSON.stringify({ project: proj.slug, name: proj.name, learn: entry && typeof entry.learn === 'boolean' ? entry.learn : null }));
}

function status() {
  const all = allLessons({ warn: false });
  const state = S.readState();
  const cfg = S.readConfig();
  const pluginJson = S.readJson(path.join(__dirname, '..', '.claude-plugin', 'plugin.json'), {});
  const pending = all.filter((l) => !state.sync[l.id] || state.sync[l.id].hash !== l.hash).length;
  const p = S.readProfile();
  console.log(JSON.stringify({
    home: S.home().replace(/\\/g, '/'),
    notesDir: S.notesDir().replace(/\\/g, '/'),
    lessons: all.length,
    projects: Object.keys(state.projects).length,
    pendingSync: pending,
    profile: { isDefault: p.isDefault, modalities: p.modalities, level: p.level },
    artifactUrl: cfg.artifactUrl || null,
    siteVersion: cfg.siteVersion || null,
    pluginVersion: pluginJson.version || null,
    sitePath: path.join(__dirname, '..', 'site', 'index.html').replace(/\\/g, '/'),
  }, null, 2));
}

function profile() {
  const action = argv[1];
  const file = path.join(S.home(), 'profile.json');
  if (action === 'get') return console.log(JSON.stringify(S.readProfile(), null, 2));
  if (action !== 'set') fail('usage: profile get | profile set (JSON on stdin)');
  return readStdin().then((raw) => {
    let input;
    try { input = JSON.parse(raw); } catch { fail('stdin is not valid JSON'); }
    if (input && input.data && typeof input.data === 'object') input = input.data;
    const next = { ...S.readJson(file, {}) };
    if (input.modalities !== undefined) {
      const bad = (Array.isArray(input.modalities) ? input.modalities : []).filter((m) => !MODALITIES[m]);
      if (!Array.isArray(input.modalities) || input.modalities.length === 0 || bad.length) fail(`modalities must be a non-empty list of: ${Object.keys(MODALITIES).join(', ')}${bad.length ? `. Unknown: ${bad.join(', ')}` : ''}`);
      next.modalities = input.modalities;
    }
    for (const k of ['known', 'rusty']) if (Array.isArray(input[k])) next[k] = input[k].filter((s) => typeof s === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s));
    for (const k of ['level', 'language']) if (typeof input[k] === 'string') next[k] = input[k];
    if (input.emphasis && typeof input.emphasis === 'object') next.emphasis = input.emphasis;
    next.updatedAt = new Date().toISOString();
    S.writeJson(file, next);
    console.log(`profile saved. Modalities: ${(next.modalities || S.readProfile().modalities).join(', ')}`);
  });
}

function config() {
  const [, action, key, value] = argv;
  const cfg = S.readConfig();
  if (action === 'set' && key && value !== undefined) { cfg[key] = value; S.writeJson(S.configFile(), cfg); console.log(`${key} saved`); }
  else if (action === 'get') console.log(JSON.stringify(cfg, null, 2));
  else fail('usage: config get | config set <key> <value>');
}

function syncPlan() {
  const state = S.readState();
  const todo = allLessons().filter((l) => !state.sync[l.id] || state.sync[l.id].hash !== l.hash);
  fs.rmSync(outbox(), { recursive: true, force: true });
  const take = todo.slice(0, BATCH);
  const writes = take.map((l) => {
    const { file, hash, ...doc } = l;
    const out = path.join(outbox(), `${l.id}.json`);
    S.writeJson(out, doc);
    const w = { op: 'set', collection: 'lessons', doc_id: l.id, file_path: out.replace(/\\/g, '/') };
    if (state.sync[l.id] && state.sync[l.id].version) w.if_version = state.sync[l.id].version;
    return w;
  });
  S.writeJson(path.join(outbox(), 'plan.json'), { items: take.map((l) => ({ id: l.id, hash: l.hash })) });
  console.log(JSON.stringify({ count: take.length, remaining: todo.length - take.length, writes }));
}

function markSynced() {
  const plan = S.readJson(path.join(outbox(), 'plan.json'), null);
  if (!plan) fail('no sync plan found, run sync-plan first');
  const state = S.readState();
  for (const { id, hash } of plan.items) state.sync[id] = { hash, version: ((state.sync[id] && state.sync[id].version) || 0) + 1 };
  S.writeState(state);
  fs.rmSync(outbox(), { recursive: true, force: true });
  console.log(`marked ${plan.items.length} lesson(s) as synced`);
}

function history() {
  const repoPath = path.resolve(argv[1] && !argv[1].startsWith('--') ? argv[1] : project);
  const limit = Number(flag('limit')) || 10;
  const proj = S.identify(repoPath);
  const done = new Set(allLessons({ warn: false }).filter((l) => l.project === proj.slug).map((l) => l.commit.hash));
  let out;
  try { out = S.git(repoPath, ['log', '--no-merges', '--numstat', '--format=@@%h|%ad|%s', '--date=short', '-n', '400']); }
  catch { fail(`${repoPath} is not a git repository or has no commits`); }
  const commits = [];
  let cur = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('@@')) {
      const [hash, date, ...s] = line.slice(2).split('|');
      cur = { hash, date, subject: s.join('|'), files: [] };
      commits.push(cur);
    } else if (cur && line.trim()) {
      const [a, d, ...rest] = line.split('\t');
      const file = rest.join('\t');
      if (!LOW_SIGNAL.test(file)) cur.files.push({ file, lines: (Number(a) || 0) + (Number(d) || 0) });
    }
  }
  const ranked = commits
    .filter((c) => c.files.length > 0 && !done.has(c.hash) && !/^(wip|merge|bump|chore\(deps\)|typo|format|lint)\b/i.test(c.subject))
    .map((c) => {
      const lines = c.files.reduce((n, f) => n + f.lines, 0);
      const dirs = new Set(c.files.map((f) => path.dirname(f.file).split('/')[0]));
      const sizeScore = lines < 8 ? 0 : lines > 900 ? 2 : Math.min(lines, 300) / 60;
      return { ...c, lines, areas: dirs.size, score: sizeScore + Math.min(dirs.size, 3) * 0.7 + (/^(feat|add|implement|fix|refactor)/i.test(c.subject) ? 1 : 0) };
    })
    .filter((c) => c.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  console.log(JSON.stringify({ project: proj.slug, projectName: proj.name, repo: repoPath.replace(/\\/g, '/'), scanned: commits.length, alreadyLearned: done.size, candidates: ranked.map((c) => ({ hash: c.hash, date: c.date, subject: c.subject, files: c.files.length, lines: c.lines })) }, null, 2));
}

const cmd = argv[0];
const commands = { add, list, status, repo, config, profile, 'sync-plan': syncPlan, 'mark-synced': markSynced, history };
if (commands[cmd]) commands[cmd]();
else fail(`usage: lbd.js ${Object.keys(commands).join('|')}`);
