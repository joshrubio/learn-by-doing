/* A compact, deterministic picture of a repo for the project primer: what it says it is,
   what it is made of, how it is laid out and where it starts. Claude reads the key files
   afterwards, this only points at them. */
const fs = require('fs');
const path = require('path');
const S = require('./shared');
const D = require('./detect');

const SKIP_DIR = /(^|\/)(node_modules|\.git|dist|build|\.next|\.venv|venv|__pycache__|target|vendor|coverage|\.turbo|\.cache)(\/|$)/;
const LOW_SIGNAL = /\.(png|jpe?g|gif|ico|svg|woff2?|map|lock|min\.js)$|(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|Cargo\.lock|poetry\.lock)$/i;
const ENTRY = /(^|\/)((index|main|app|server|cli|mod|lib)\.(js|mjs|cjs|ts|tsx|jsx|py|go|rs|rb|php)|manage\.py|Program\.cs|Main\.java|main\.go|SKILL\.md|plugin\.json|hooks\.json|\.mcp\.json|mcp\.json)$/i;
const MAX_TREE = 90;
const MAX_README = 2500;

function trackedFiles(dir) {
  try {
    const out = S.git(dir, ['ls-files', '--cached', '--others', '--exclude-standard']);
    return out.split('\n').map((f) => f.trim()).filter(Boolean);
  } catch {
    const files = [];
    const walk = (rel, depth) => {
      if (depth > 4 || files.length > 3000) return;
      let entries = [];
      try { entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (SKIP_DIR.test(r)) continue;
        if (e.isDirectory()) walk(r, depth + 1); else files.push(r);
      }
    };
    walk('', 0);
    return files;
  }
}

const read = (file, max) => { try { return fs.readFileSync(file, 'utf8').slice(0, max); } catch { return ''; } };

function manifests(dir, files) {
  const out = {};
  const roots = files.filter((f) => /^([^/]+\/)?(package\.json|pyproject\.toml|go\.mod|Cargo\.toml|composer\.json|Gemfile|pom\.xml|requirements\.txt)$/.test(f)).slice(0, 6);
  for (const f of roots) {
    if (f.endsWith('package.json')) {
      try {
        const j = JSON.parse(read(path.join(dir, f), 200000));
        out[f] = {
          name: j.name, description: j.description, main: j.main, bin: j.bin, type: j.type,
          scripts: j.scripts ? Object.keys(j.scripts).slice(0, 12) : undefined,
          dependencies: Object.keys(j.dependencies || {}).slice(0, 25),
          devDependencies: Object.keys(j.devDependencies || {}).slice(0, 15),
        };
      } catch { out[f] = read(path.join(dir, f), 600); }
    } else out[f] = read(path.join(dir, f), 700);
  }
  return out;
}

/* Directories to depth 2 with their file counts, then the top-level files. */
function tree(files) {
  const dirs = new Map();
  const top = [];
  for (const f of files) {
    if (SKIP_DIR.test(f) || LOW_SIGNAL.test(f)) continue;
    const parts = f.split('/');
    if (parts.length === 1) { top.push(f); continue; }
    const d1 = parts[0];
    dirs.set(d1, (dirs.get(d1) || 0) + 1);
    if (parts.length > 2) { const d2 = `${parts[0]}/${parts[1]}`; dirs.set(d2, (dirs.get(d2) || 0) + 1); }
  }
  const lines = [...dirs.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([d, n]) => `${d}/  (${n} file${n === 1 ? '' : 's'})`);
  const all = [...lines, ...top.sort().map((f) => f)];
  return { lines: all.slice(0, MAX_TREE), truncated: all.length > MAX_TREE };
}

function scan(dir) {
  const files = trackedFiles(dir);
  const proj = S.identify(dir);
  let det = null;
  try { det = D.detect(dir); } catch {}
  const readmeFile = files.find((f) => /^readme(\.[a-z]+)?$/i.test(f));
  const t = tree(files);
  const entryPoints = files.filter((f) => ENTRY.test(f) && !SKIP_DIR.test(f)).slice(0, 20);
  let recent = [];
  try { recent = S.git(dir, ['log', '--no-merges', '-n', '15', '--format=%h %s']).trim().split('\n').filter(Boolean); } catch {}
  let total = 0;
  for (const f of files) if (!SKIP_DIR.test(f) && !LOW_SIGNAL.test(f)) total++;
  return {
    project: proj.slug,
    name: proj.name,
    path: proj.dir,
    remote: proj.remote || null,
    kind: det ? det.kind : 'otro',
    languages: det ? det.languages : [],
    frameworks: det ? det.frameworks : [],
    sourceFiles: total,
    readme: readmeFile ? { file: readmeFile, text: read(path.join(dir, readmeFile), MAX_README) } : null,
    manifests: manifests(dir, files),
    entryPoints,
    tree: t.lines,
    treeTruncated: t.truncated,
    recentCommits: recent,
    next: 'Read the README, the entry points and 3 to 6 files that carry the main flow, then save the memory with save_project_memory and the base lessons with save_lessons.',
  };
}

module.exports = { scan };
