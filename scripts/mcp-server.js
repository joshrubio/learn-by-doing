#!/usr/bin/env node
/* Minimal MCP server (stdio, newline-delimited JSON-RPC, no dependencies).
   It gives Claude structured tools instead of shell commands, so saving a lesson needs
   no heredoc, no temp file and no quoting, and works the same on Windows, macOS and Linux. */
const path = require('path');
const { spawnSync } = require('child_process');

const LBD = path.join(__dirname, 'lbd.js');
let version = '0.0.0';
try { version = require('../.claude-plugin/plugin.json').version; } catch {}

const TOOLS = [
  {
    name: 'save_lessons',
    description: 'Save the lessons of one commit as notes. Only for repos the user turned on. Every lesson needs a scope (universal, lenguaje, framework or tipo); languages, frameworks and the project kind are filled in automatically. If a lesson is invalid the tool returns the reason, fix it and call again. Lesson fields are described in the learn-by-doing skill.',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Absolute path of the repository' },
        commit: {
          type: 'object',
          properties: { hash: { type: 'string' }, message: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD, only for commits from the past' } },
          required: ['hash', 'message'],
        },
        lessons: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'object', additionalProperties: true } },
      },
      required: ['project', 'commit', 'lessons'],
    },
  },
  {
    name: 'scan_project',
    description: 'Compact scan of a repo for the project primer: README excerpt, manifests, entry points, folder tree and recent commits. Only for repos the user turned on and asked a primer for. Read the key files afterwards, then call save_project_memory and save_lessons.',
    inputSchema: {
      type: 'object',
      properties: { project: { type: 'string', description: 'Absolute path of the repository' } },
      required: ['project'],
    },
  },
  {
    name: 'save_project_memory',
    description: 'Save what the plugin remembers about a repo: what it is, where things live, its main flow and the concepts that matter most in it. The commit hook hands this back to Claude on every later commit so lessons are placed in the project and favor its core. Only for repos the user turned on.',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Absolute path of the repository' },
        summary: { type: 'string', description: 'What the project is and who it is for, at most 500 characters' },
        structure: {
          type: 'array', minItems: 2, maxItems: 14,
          description: 'Where things live: the pieces of the project, one line each',
          items: { type: 'object', properties: { path: { type: 'string', description: 'Folder or file, at most 80 characters' }, role: { type: 'string', description: 'What it is responsible for, at most 160 characters' } }, required: ['path', 'role'] },
        },
        flow: { type: 'string', description: 'Optional. The main flow in one or two sentences, at most 500 characters' },
        core: { type: 'array', minItems: 3, maxItems: 8, items: { type: 'string' }, description: 'The ideas that matter most in this project, as kebab-case concept slugs (catalog ids when one fits)' },
        diagram: { type: 'string', description: 'Optional ASCII map of the project, at most 16 lines and 64 columns' },
        commit: { type: 'string', description: 'Optional. Short hash of HEAD when the memory was built' },
      },
      required: ['project', 'summary', 'structure', 'core'],
    },
  },
  {
    name: 'list_concepts',
    description: 'List every concept already saved across all repos (slug, type, area, project, commit, title). Call it before writing lessons so existing slugs are reused.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'set_repo',
    description: 'Record the user\'s decision about learning from a repo. Call it only after the user answered the question.',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Absolute path of the repository' },
        enabled: { type: 'boolean' },
        kind: { type: 'string', enum: ['app', 'libreria', 'plugin', 'mcp', 'integracion', 'script', 'infraestructura', 'otro'], description: 'Only when the user corrected the detected kind of project' },
      },
      required: ['project', 'enabled'],
    },
  },
];

function run(args, input) {
  const r = spawnSync(process.execPath, [LBD, ...args], { input, encoding: 'utf8', env: process.env, maxBuffer: 16 * 1024 * 1024 });
  const text = `${r.stdout || ''}${r.stderr || ''}`.trim();
  return { text: text || (r.status === 0 ? 'ok' : 'failed'), isError: r.status !== 0 };
}

function call(name, a) {
  if (name === 'save_lessons') {
    if (!a || typeof a.project !== 'string' || !a.commit || !Array.isArray(a.lessons)) return { text: 'project, commit and lessons are required', isError: true };
    return run(['add', '--project', a.project], JSON.stringify({ commit: a.commit, lessons: a.lessons }));
  }
  if (name === 'scan_project') {
    if (!a || typeof a.project !== 'string') return { text: 'project is required', isError: true };
    return run(['scan', '--project', a.project]);
  }
  if (name === 'save_project_memory') {
    if (!a || typeof a.project !== 'string') return { text: 'project is required', isError: true };
    const { project, ...memory } = a;
    return run(['memory', 'save', '--project', project], JSON.stringify(memory));
  }
  if (name === 'list_concepts') return run(['list']);
  if (name === 'set_repo') {
    if (!a || typeof a.project !== 'string' || typeof a.enabled !== 'boolean') return { text: 'project and enabled are required', isError: true };
    return run(['repo', a.enabled ? 'enable' : 'disable', '--project', a.project, ...(a.kind ? ['--kind', String(a.kind)] : [])]);
  }
  return { text: `unknown tool ${name}`, isError: true };
}

const send = (msg) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n');

function handle(msg) {
  const { id, method, params } = msg;
  if (id === undefined) return;
  if (method === 'initialize') return send({ id, result: { protocolVersion: (params && params.protocolVersion) || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'learn-by-doing', version } } });
  if (method === 'ping') return send({ id, result: {} });
  if (method === 'tools/list') return send({ id, result: { tools: TOOLS } });
  if (method === 'tools/call') {
    let out;
    try { out = call(params && params.name, (params && params.arguments) || {}); }
    catch (e) { out = { text: String(e && e.message || e), isError: true }; }
    return send({ id, result: { content: [{ type: 'text', text: out.text }], isError: out.isError } });
  }
  return send({ id, error: { code: -32601, message: `method not found: ${method}` } });
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    try { handle(JSON.parse(line)); } catch { /* ignore malformed input */ }
  }
});
