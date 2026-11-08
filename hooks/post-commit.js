#!/usr/bin/env node
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const COMMIT_CMD = /\bgit\s+(?:-C\s+\S+\s+|-c\s+\S+\s+)*commit\b/;
const COMMIT_OUT = /\[[^\]\n]+\s[0-9a-f]{7,}\]/;
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

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

function main(raw) {
  let input;
  try { input = JSON.parse(raw); } catch { return; }
  if (input.tool_name !== 'Bash') return;
  const command = (input.tool_input && input.tool_input.command) || '';
  if (!COMMIT_CMD.test(command)) return;
  const out = typeof input.tool_response === 'string' ? input.tool_response : JSON.stringify(input.tool_response || '');
  if (!COMMIT_OUT.test(out)) return;

  const cwd = input.cwd || process.cwd();
  const lbdHome = process.env.LBD_HOME || path.join(os.homedir(), '.learn-by-doing');
  if (fs.existsSync(path.join(lbdHome, 'off')) || fs.existsSync(path.join(cwd, '.learn-off'))) return;

  let hash, message, numstat, patch;
  try {
    hash = git(cwd, ['rev-parse', '--short', 'HEAD']).trim();
    message = git(cwd, ['log', '-1', '--format=%s']).trim();
    numstat = git(cwd, ['show', 'HEAD', '--numstat', '--format=']).trim().split('\n').filter(Boolean);
    patch = git(cwd, ['show', 'HEAD', '--format=', '--unified=2', '--no-color']);
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
  const truncated = patch.length > MAX_PATCH;
  const patchText = truncated ? patch.slice(0, MAX_PATCH) + '\n... [patch truncated, use git show for the rest]' : patch;
  const lbd = path.join(__dirname, '..', 'scripts', 'lbd.js').replace(/\\/g, '/');

  let profileLines = [];
  try {
    const { readProfile } = require(path.join(__dirname, '..', 'scripts', 'shared.js'));
    const p = readProfile();
    profileLines = [
      `Learner profile${p.isDefault ? ' (no profile set yet, defaults)' : ''}: allowed exercise modalities = ${p.modalities.join(', ')}.`,
      p.level ? `Level: ${p.level}.` : '',
      p.known.length ? `Known concepts, skip them: ${p.known.join(', ')}.` : '',
      p.rusty.length ? `Rusty concepts, teach as a short refresher: ${p.rusty.join(', ')}.` : '',
    ].filter(Boolean);
  } catch {}

  const context = [
    `[learn-by-doing] A commit was just made: ${hash} "${message}".`,
    ...profileLines,
    `Size: ${useful.length} file(s), ${lines} line(s) changed${large ? ' -> LARGE commit, apply the large-commit rule' : ''}.`,
    'Changed areas:',
    areaList,
    '',
    'Follow the learn-by-doing skill now, silently, without interrupting the user: pick the lessons worth teaching from this commit and save them with:',
    `  node "${lbd}" add --project "${cwd.replace(/\\/g, '/')}"   (lesson JSON on stdin)`,
    'Then add one short line at the end of your reply, like "N lessons saved from this commit, open them with /study". Do not explain the lessons in chat.',
    '',
    '--- patch ---',
    patchText,
  ].join('\n');

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: context },
  }));
}

let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (data += c));
process.stdin.on('end', () => main(data));
