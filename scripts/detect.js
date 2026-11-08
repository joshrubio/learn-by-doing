/* Deterministic project detection: kind, languages and frameworks, per package.
   Tags come from here and not from the model, so names never drift. */
const fs = require('fs');
const path = require('path');
const { git } = require('./shared');

const LANG_BY_EXT = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript', mts: 'typescript', cts: 'typescript',
  py: 'python', go: 'go', rs: 'rust', java: 'java', kt: 'kotlin', cs: 'csharp', rb: 'ruby', php: 'php', swift: 'swift',
  sql: 'sql', sh: 'shell', ps1: 'shell', cmd: 'shell', bat: 'shell', html: 'html', css: 'css', scss: 'css', tf: 'terraform',
};
const LANG_IGNORED_FOR_SHARE = new Set(['html', 'css', 'shell', 'sql']);

const MANIFESTS = ['package.json', 'pyproject.toml', 'requirements.txt', 'go.mod', 'Cargo.toml', 'pom.xml', 'build.gradle', 'build.gradle.kts', 'composer.json', 'Gemfile'];

const NPM_FRAMEWORKS = {
  react: 'react', 'react-dom': 'react', next: 'nextjs', vue: 'vue', nuxt: 'nuxt', '@sveltejs/kit': 'sveltekit', svelte: 'svelte',
  '@angular/core': 'angular', express: 'express', fastify: 'fastify', koa: 'koa', '@nestjs/core': 'nestjs', hono: 'hono',
  electron: 'electron', vite: 'vite', tailwindcss: 'tailwind', '@prisma/client': 'prisma', vitest: 'vitest', jest: 'jest',
  '@playwright/test': 'playwright', '@modelcontextprotocol/sdk': 'mcp-sdk',
};
const TEXT_FRAMEWORKS = [
  [/\bfastapi\b/, 'fastapi'], [/\bdjango\b/, 'django'], [/\bflask\b/, 'flask'], [/\bfastmcp\b|\bmcp\b/, 'mcp-sdk'], [/\bpytest\b/, 'pytest'],
  [/gin-gonic\/gin/, 'gin'], [/labstack\/echo/, 'echo'], [/gofiber\/fiber/, 'fiber'],
  [/\baxum\b/, 'axum'], [/\bactix-web\b/, 'actix'], [/\brocket\b/, 'rocket'], [/\btokio\b/, 'tokio'],
  [/spring-boot/, 'spring'], [/laravel\/framework/, 'laravel'], [/symfony\//, 'symfony'], [/\brails\b/, 'rails'],
];
const APP_FRAMEWORKS = new Set(['react', 'nextjs', 'vue', 'nuxt', 'sveltekit', 'svelte', 'angular', 'express', 'fastify', 'koa', 'nestjs', 'hono', 'electron', 'fastapi', 'django', 'flask', 'gin', 'echo', 'fiber', 'axum', 'actix', 'rocket', 'spring', 'laravel', 'symfony', 'rails']);
const INTEGRATION_DEPS = /^(@slack\/|@notionhq\/|stripe$|twilio$|googleapis$|@octokit\/|@sendgrid\/|airtable$|zapier|n8n)/;

function listFiles(dir) {
  try {
    const out = git(dir, ['ls-files']).split('\n').filter(Boolean);
    if (out.length) return out.slice(0, 20000);
  } catch {}
  const files = [];
  const skip = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'venv', '.venv', 'target']);
  (function walk(d, depth) {
    if (depth > 4 || files.length > 5000) return;
    let entries = [];
    try { entries = fs.readdirSync(path.join(dir, d), { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const rel = d ? `${d}/${e.name}` : e.name;
      if (e.isDirectory()) { if (!skip.has(e.name)) walk(rel, depth + 1); } else files.push(rel);
    }
  })('', 0);
  return files;
}

const extOf = (f) => { const m = /\.([a-z0-9]+)$/i.exec(f); return m ? m[1].toLowerCase() : ''; };
const languageOfFile = (f) => (/(^|\/)Dockerfile/i.test(f) ? 'docker' : LANG_BY_EXT[extOf(f)] || '');
const read = (dir, rel) => { try { return fs.readFileSync(path.join(dir, rel), 'utf8'); } catch { return ''; } };
const dirOf = (rel) => { const i = rel.lastIndexOf('/'); return i < 0 ? '' : rel.slice(0, i); };

function frameworksOf(dir, pkgDir, manifests) {
  const found = new Set();
  const deps = {};
  let pkgJson = null;
  for (const m of manifests) {
    const rel = pkgDir ? `${pkgDir}/${m}` : m;
    const text = read(dir, rel);
    if (!text) continue;
    if (m === 'package.json') {
      try {
        pkgJson = JSON.parse(text);
        Object.assign(deps, pkgJson.dependencies, pkgJson.devDependencies, pkgJson.peerDependencies);
        for (const [name, slug] of Object.entries(NPM_FRAMEWORKS)) if (deps[name]) found.add(slug);
      } catch {}
    } else {
      const lower = text.toLowerCase();
      for (const [re, slug] of TEXT_FRAMEWORKS) if (re.test(lower)) found.add(slug);
    }
  }
  return { frameworks: [...found].sort(), deps, pkgJson };
}

function kindOf({ dir, pkgDir, frameworks, deps, pkgJson, files, codeFiles }) {
  const has = (rel) => files.includes(pkgDir ? `${pkgDir}/${rel}` : rel);
  const reasons = [];
  if (has('.claude-plugin/plugin.json') || has('.claude-plugin/marketplace.json')) return { kind: 'plugin', confidence: 'alta', reasons: ['has .claude-plugin/'] };
  if (frameworks.includes('mcp-sdk') || has('.mcp.json') || files.some((f) => /(^|\/)mcp[-_]?server\./i.test(f) && (!pkgDir || f.startsWith(pkgDir + '/')))) {
    return { kind: 'mcp', confidence: 'alta', reasons: ['uses an MCP SDK or ships an MCP server'] };
  }
  const infra = files.filter((f) => (!pkgDir || f.startsWith(pkgDir + '/')) && (/\.tf$/.test(f) || /(^|\/)(Dockerfile|docker-compose\.ya?ml|serverless\.ya?ml|Chart\.yaml)$/i.test(f) || /(^|\/)(k8s|kubernetes|helm|terraform|ansible)\//i.test(f)));
  if (infra.length >= 2 && infra.length >= codeFiles.length) return { kind: 'infraestructura', confidence: 'media', reasons: ['mostly infrastructure files'] };
  const appFw = frameworks.filter((f) => APP_FRAMEWORKS.has(f));
  if (appFw.length) return { kind: 'app', confidence: 'media', reasons: [`uses ${appFw.join(', ')}`] };
  const depNames = Object.keys(deps || {});
  if (depNames.some((d) => INTEGRATION_DEPS.test(d))) return { kind: 'integracion', confidence: 'media', reasons: ['depends on a third-party service SDK'] };
  if (pkgJson) {
    if (pkgJson.bin && codeFiles.length < 12) return { kind: 'script', confidence: 'media', reasons: ['small package with a bin entry'] };
    if ((pkgJson.main || pkgJson.exports || pkgJson.module || pkgJson.types) && pkgJson.private !== true) return { kind: 'libreria', confidence: 'media', reasons: ['exposes main/exports and is not private'] };
  }
  if (codeFiles.length > 0 && codeFiles.length <= 6) return { kind: 'script', confidence: 'baja', reasons: ['only a few code files'] };
  return { kind: 'otro', confidence: 'baja', reasons: ['no clear signal'] };
}

function detect(dir) {
  const files = listFiles(dir);
  const manifestDirs = new Map();
  for (const f of files) {
    const base = f.split('/').pop();
    const depth = f.split('/').length - 1;
    if (depth > 3) continue;
    if (MANIFESTS.includes(base)) {
      const d = dirOf(f);
      manifestDirs.set(d, [...(manifestDirs.get(d) || []), base]);
    } else if (/(^|\/)\.claude-plugin\/plugin\.json$/.test(f)) {
      const d = dirOf(dirOf(f));
      if (!manifestDirs.has(d)) manifestDirs.set(d, []);
    }
  }
  if (!manifestDirs.size) manifestDirs.set('', []);
  const dirs = [...manifestDirs.keys()].sort((a, b) => b.length - a.length);
  const owner = (f) => dirs.find((d) => d === '' || f === d || f.startsWith(d + '/')) ?? '';

  const packages = [];
  for (const d of [...manifestDirs.keys()].sort()) {
    const mine = files.filter((f) => owner(f) === d);
    const counts = {};
    for (const f of mine) { const l = languageOfFile(f); if (l) counts[l] = (counts[l] || 0) + 1; }
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    const languages = Object.entries(counts)
      .filter(([l, n]) => (n >= 3 || n / total >= 0.15) && !(LANG_IGNORED_FOR_SHARE.has(l) && n / total < 0.4))
      .sort((a, b) => b[1] - a[1]).map(([l]) => l);
    const codeFiles = mine.filter((f) => languageOfFile(f) && !['html', 'css'].includes(languageOfFile(f)));
    const { frameworks, deps, pkgJson } = frameworksOf(dir, d, manifestDirs.get(d));
    const k = kindOf({ dir, pkgDir: d, frameworks, deps, pkgJson, files, codeFiles });
    packages.push({ path: d, kind: k.kind, confidence: k.confidence, reasons: k.reasons, languages, frameworks });
  }
  const root = packages.find((p) => p.path === '') || packages[0];
  const all = (key) => [...new Set(packages.flatMap((p) => p[key]))];
  const monorepo = packages.length > 1;
  const counts = {};
  packages.forEach((p) => { counts[p.kind] = (counts[p.kind] || 0) + 1; });
  const kind = monorepo && !packages.some((p) => p.path === '' && p.kind !== 'otro')
    ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    : root.kind;
  return {
    kind, confidence: root.confidence, reasons: root.reasons, monorepo,
    languages: all('languages'), frameworks: all('frameworks'), packages,
    detectedAt: new Date().toISOString(),
  };
}

/* The package a file belongs to: longest matching path. */
function packageFor(det, file, repoDir) {
  let rel = String(file || '').replace(/\\/g, '/');
  const root = String(repoDir || '').replace(/\\/g, '/').replace(/\/$/, '');
  if (root && rel.toLowerCase().startsWith(root.toLowerCase() + '/')) rel = rel.slice(root.length + 1);
  const pkgs = [...det.packages].sort((a, b) => b.path.length - a.path.length);
  const hit = pkgs.find((p) => p.path === '' || rel === p.path || rel.startsWith(p.path + '/'));
  return hit || { path: '', kind: det.kind, confidence: det.confidence, reasons: det.reasons, languages: det.languages, frameworks: det.frameworks };
}

module.exports = { detect, packageFor, languageOfFile };

if (require.main === module) {
  const dir = path.resolve(process.argv[2] || process.cwd());
  console.log(JSON.stringify(detect(dir), null, 2));
}
