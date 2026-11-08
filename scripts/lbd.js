#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const { MODALITIES, readProfile } = require('./shared');

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
const home = process.env.LBD_HOME || path.join(os.homedir(), '.learn-by-doing');
const storeFile = path.join(home, 'store.json');
const configFile = path.join(home, 'config.json');
const outbox = path.join(home, 'outbox');
const project = path.resolve(flag('project') || process.env.LBD_PROJECT || process.cwd());

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
const load = () => readJson(storeFile, { version: 2, projects: {}, lessons: [], appearances: [] });
const save = (d) => writeJson(storeFile, d);
const str = (v) => typeof v === 'string' && v.trim().length > 0;
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'proyecto';
const fail = (msg) => { console.error(`lbd: ${msg}`); process.exit(1); };

function git(dir, args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
}

function identify(dir) {
  let remote = '';
  try { remote = git(dir, ['remote', 'get-url', 'origin']).trim(); } catch {}
  const m = remote.match(/[:/]([^/:]+\/[^/]+?)(?:\.git)?$/);
  const name = m ? m[1].split('/')[1] : path.basename(dir);
  const slug = slugify(m ? m[1].replace('/', '-') : path.basename(dir));
  return { slug, name, remote, dir: dir.replace(/\\/g, '/') };
}

function readStdin() {
  return new Promise((resolve) => {
    let d = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (d += c));
    process.stdin.on('end', () => resolve(d));
  });
}

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
  const profile = readProfile();
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

async function add() {
  let input;
  try { input = JSON.parse(await readStdin()); } catch { fail('stdin is not valid JSON'); }
  const lessons = Array.isArray(input.lessons) ? input.lessons : [];
  if (lessons.length === 0) fail('no lessons given');
  if (lessons.length > MAX_PER_COMMIT) fail(`at most ${MAX_PER_COMMIT} lessons per commit, got ${lessons.length}. Keep the most valuable ones`);
  const problems = lessons.map(validate).filter(Boolean);
  if (problems.length) fail(problems.join('\n'));

  const data = load();
  const proj = identify(project);
  const commit = input.commit || {};
  const now = new Date().toISOString();
  const known = data.projects[proj.slug];
  data.projects[proj.slug] = { name: proj.name, path: proj.dir, remote: proj.remote, firstSeen: known ? known.firstSeen : now, lastSeen: now };

  let added = 0, repeated = 0;
  for (const l of lessons) {
    const dup = data.lessons.find((x) => x.id === l.concept);
    if (dup) {
      const key = `${l.concept}__${proj.slug}__${commit.hash || 'none'}`;
      if (!data.appearances.some((a) => a.id === key)) {
        data.appearances.push({ id: key, concept: l.concept, project: proj.slug, projectName: proj.name, commit: { hash: commit.hash || '', message: commit.message || '' }, at: now, synced: false });
      }
      repeated++;
      continue;
    }
    data.lessons.push({
      id: l.concept,
      createdAt: now,
      project: proj.slug,
      projectName: proj.name,
      commit: { hash: commit.hash || '', message: commit.message || '', date: commit.date || '' },
      context: { building: l.context.building, snippetRole: l.context.snippetRole, learning: l.context.learning },
      type: l.type, area: l.area, concept: l.concept, title: l.title,
      code: { file: (l.code.file || '').toString(), text: l.code.text },
      predict: l.predict, explain: l.explain,
      exercise: cleanExercise(l.exercise),
      related: Array.isArray(l.related) ? l.related.filter(str) : [],
      example: l.example === true,
      synced: false,
    });
    added++;
  }
  save(data);
  console.log(`saved ${added} new lesson(s), ${repeated} repeated concept(s) recorded as appearances. Project: ${proj.slug}. Total lessons: ${data.lessons.length}`);
}

function list() {
  const data = load();
  if (data.lessons.length === 0) return console.log('no lessons yet');
  for (const l of data.lessons) console.log(`${l.concept}\t${l.type}\t${l.area}\t${l.project}\t${l.commit.hash}\t${l.title}`);
}

function status() {
  const data = load();
  const cfg = readJson(configFile, {});
  const pluginJson = readJson(path.join(__dirname, '..', '.claude-plugin', 'plugin.json'), {});
  const pending = data.lessons.filter((l) => !l.synced).length + data.appearances.filter((a) => !a.synced).length;
  console.log(JSON.stringify({
    home: home.replace(/\\/g, '/'),
    lessons: data.lessons.length,
    projects: Object.keys(data.projects).length,
    pendingSync: pending,
    profile: (({ isDefault, modalities, level }) => ({ isDefault, modalities, level }))(readProfile()),
    artifactUrl: cfg.artifactUrl || null,
    siteVersion: cfg.siteVersion || null,
    pluginVersion: pluginJson.version || null,
    sitePath: path.join(__dirname, '..', 'site', 'index.html').replace(/\\/g, '/'),
  }, null, 2));
}

function profile() {
  const action = argv[1];
  const file = path.join(home, 'profile.json');
  if (action === 'get') return console.log(JSON.stringify(readProfile(), null, 2));
  if (action !== 'set') fail('usage: profile get | profile set (JSON on stdin)');
  return readStdin().then((raw) => {
    let input;
    try { input = JSON.parse(raw); } catch { fail('stdin is not valid JSON'); }
    if (input && input.data && typeof input.data === 'object') input = input.data;
    const current = readJson(file, {});
    const next = { ...current };
    if (input.modalities !== undefined) {
      const bad = (Array.isArray(input.modalities) ? input.modalities : []).filter((m) => !MODALITIES[m]);
      if (!Array.isArray(input.modalities) || input.modalities.length === 0 || bad.length) fail(`modalities must be a non-empty list of: ${Object.keys(MODALITIES).join(', ')}${bad.length ? `. Unknown: ${bad.join(', ')}` : ''}`);
      next.modalities = input.modalities;
    }
    for (const k of ['known', 'rusty']) if (Array.isArray(input[k])) next[k] = input[k].filter((s) => typeof s === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s));
    for (const k of ['level', 'language']) if (typeof input[k] === 'string') next[k] = input[k];
    if (input.emphasis && typeof input.emphasis === 'object') next.emphasis = input.emphasis;
    next.updatedAt = new Date().toISOString();
    writeJson(file, next);
    console.log(`profile saved. Modalities: ${(next.modalities || readProfile().modalities).join(', ')}`);
  });
}

function config() {
  const [, action, key, value] = argv;
  const cfg = readJson(configFile, {});
  if (action === 'set' && key && value !== undefined) { cfg[key] = value; writeJson(configFile, cfg); console.log(`${key} saved`); }
  else if (action === 'get') console.log(JSON.stringify(cfg, null, 2));
  else fail('usage: config get | config set <key> <value>');
}

function syncPlan() {
  const data = load();
  const docs = [];
  for (const l of data.lessons.filter((x) => !x.synced)) {
    const { synced, ...body } = l;
    docs.push({ kind: 'lesson', id: l.id, collection: 'lessons', body });
  }
  for (const a of data.appearances.filter((x) => !x.synced)) {
    const { synced, ...body } = a;
    docs.push({ kind: 'appearance', id: a.id, collection: 'appearances', body });
  }
  fs.rmSync(outbox, { recursive: true, force: true });
  const take = docs.slice(0, BATCH);
  const writes = take.map((d) => {
    const file = path.join(outbox, `${d.kind}-${d.id}.json`);
    writeJson(file, d.body);
    return { op: 'set', collection: d.collection, doc_id: d.id, file_path: file.replace(/\\/g, '/') };
  });
  writeJson(path.join(outbox, 'plan.json'), { ids: take.map((d) => ({ kind: d.kind, id: d.id })) });
  console.log(JSON.stringify({ count: take.length, remaining: docs.length - take.length, writes }));
}

function markSynced() {
  const plan = readJson(path.join(outbox, 'plan.json'), null);
  if (!plan) fail('no sync plan found, run sync-plan first');
  const data = load();
  for (const { kind, id } of plan.ids) {
    const list = kind === 'lesson' ? data.lessons : data.appearances;
    const item = list.find((x) => x.id === id);
    if (item) item.synced = true;
  }
  save(data);
  fs.rmSync(outbox, { recursive: true, force: true });
  console.log(`marked ${plan.ids.length} item(s) as synced`);
}

function history() {
  const repo = path.resolve(argv[1] && !argv[1].startsWith('--') ? argv[1] : project);
  const limit = Number(flag('limit')) || 10;
  const proj = identify(repo);
  const data = load();
  const done = new Set(data.lessons.filter((l) => l.project === proj.slug).map((l) => l.commit.hash));
  let out;
  try { out = git(repo, ['log', '--no-merges', '--numstat', '--format=@@%h|%ad|%s', '--date=short', '-n', '400']); }
  catch { fail(`${repo} is not a git repository or has no commits`); }
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
  console.log(JSON.stringify({ project: proj.slug, projectName: proj.name, repo: repo.replace(/\\/g, '/'), scanned: commits.length, alreadyLearned: done.size, candidates: ranked.map((c) => ({ hash: c.hash, date: c.date, subject: c.subject, files: c.files.length, lines: c.lines })) }, null, 2));
}

const cmd = argv[0];
const commands = { add, list, status, config, profile, 'sync-plan': syncPlan, 'mark-synced': markSynced, history };
if (commands[cmd]) commands[cmd]();
else fail(`usage: lbd.js ${Object.keys(commands).join('|')}`);
