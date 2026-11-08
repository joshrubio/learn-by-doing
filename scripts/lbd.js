#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const TYPES = ['concepto', 'decision', 'riesgo', 'lectura'];
const AREAS = ['frontend', 'backend', 'base-de-datos', 'tests', 'config', 'codigo', 'docs', 'otros'];
const MAX_PER_COMMIT = 4;

const pi = process.argv.indexOf('--project');
const project = (pi > -1 && process.argv[pi + 1]) || process.env.LBD_PROJECT || process.cwd();
const dir = path.join(project, '.learn');
const file = path.join(dir, 'lessons.json');

function load() {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return { version: 1, lessons: [] }; }
}

function save(data) {
  fs.mkdirSync(dir, { recursive: true });
  const ignore = path.join(dir, '.gitignore');
  if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, '*\n');
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function readStdin() {
  return new Promise((resolve) => {
    let d = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (d += c));
    process.stdin.on('end', () => resolve(d));
  });
}

const str = (v) => typeof v === 'string' && v.trim().length > 0;

function validate(l, i) {
  const errs = [];
  if (!TYPES.includes(l.type)) errs.push(`type must be one of ${TYPES.join(', ')}`);
  if (!AREAS.includes(l.area)) errs.push(`area must be one of ${AREAS.join(', ')}`);
  if (!str(l.concept) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(l.concept)) errs.push('concept must be a kebab-case slug');
  for (const k of ['title', 'predict', 'explain', 'challenge']) if (!str(l[k])) errs.push(`${k} is required`);
  if (!l.code || !str(l.code.text)) errs.push('code.text is required');
  else if (l.code.text.split('\n').length > 20) errs.push('code.text is longer than 20 lines, keep only the lines that matter');
  const c = l.check;
  if (!c || !str(c.question) || !str(c.why)) errs.push('check.question and check.why are required');
  else if (!Array.isArray(c.options) || c.options.length < 2 || c.options.length > 5 || !c.options.every(str)) errs.push('check.options must be 2 to 5 non-empty strings');
  else if (!Number.isInteger(c.answer) || c.answer < 0 || c.answer >= c.options.length) errs.push('check.answer must be a valid option index');
  return errs.length ? `lesson ${i + 1}: ${errs.join('; ')}` : null;
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
  const commit = input.commit || {};
  const now = new Date().toISOString();
  let added = 0, repeated = 0;
  for (const l of lessons) {
    const dup = data.lessons.find((x) => x.concept === l.concept);
    if (dup) {
      dup.seenAgain = (dup.seenAgain || 0) + 1;
      dup.lastSeenCommit = commit.hash || null;
      repeated++;
      continue;
    }
    data.lessons.push({
      id: `${l.concept}-${data.lessons.length + 1}`,
      createdAt: now,
      commit: { hash: commit.hash || '', message: commit.message || '' },
      type: l.type, area: l.area, concept: l.concept, title: l.title,
      code: { file: (l.code.file || '').toString(), text: l.code.text },
      predict: l.predict, explain: l.explain, challenge: l.challenge,
      check: { question: l.check.question, options: l.check.options, answer: l.check.answer, why: l.check.why },
      related: Array.isArray(l.related) ? l.related.filter(str) : [],
    });
    added++;
  }
  save(data);
  console.log(`saved ${added} new lesson(s), ${repeated} repeated concept(s) skipped. Total: ${data.lessons.length}`);
}

function list() {
  const data = load();
  if (data.lessons.length === 0) return console.log('no lessons yet');
  for (const l of data.lessons) console.log(`${l.concept}\t${l.type}\t${l.area}\t${l.commit.hash}\t${l.title}`);
}

function build() {
  const data = load();
  if (data.lessons.length === 0) return console.log('no lessons yet');
  let profile = {};
  try { profile = JSON.parse(fs.readFileSync(path.join(dir, 'profile.json'), 'utf8')); } catch {}
  const tpl = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
  const payload = JSON.stringify({ project: path.basename(project), profile, lessons: data.lessons }).replace(/</g, '\\u003c');
  const out = path.join(dir, 'study.html');
  fs.writeFileSync(out, tpl.replace('/*DATA*/null', payload));
  console.log(`${data.lessons.length} lesson(s) -> ${out}`);
}

function fail(msg) { console.error(`lbd: ${msg}`); process.exit(1); }

const cmd = process.argv[2];
if (cmd === 'add') add();
else if (cmd === 'list') list();
else if (cmd === 'build') build();
else fail('usage: lbd.js add|list|build');
