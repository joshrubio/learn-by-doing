const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const FAMILIES = {
  recordar: 'Recordar',
  explicar: 'Explicar',
  leer: 'Leer código',
};

const MODALITIES = {
  'opcion-multiple': { family: 'recordar', kind: 'choice' },
  'recuerdo-libre': { family: 'recordar', kind: 'open' },
  explica: { family: 'explicar', kind: 'open' },
  justifica: { family: 'explicar', kind: 'open' },
  compara: { family: 'explicar', kind: 'open' },
  'predice-salida': { family: 'leer', kind: 'choice' },
  'encuentra-error': { family: 'leer', kind: 'choice' },
  'revisa-cambio': { family: 'leer', kind: 'open' },
};

const DEFAULT_MODALITIES = ['opcion-multiple', 'explica', 'predice-salida'];

/* Closed list of project kinds. "otro" is the escape hatch. */
const KINDS = ['app', 'libreria', 'plugin', 'mcp', 'integracion', 'script', 'infraestructura', 'otro'];

/* What matters most to learn in each kind of project. The weight of language and
   architecture differs, so the skill ranks lessons with this. */
const KIND_FOCUS = {
  app: 'architecture inside the framework, design patterns, data flow, infrastructure and deployment. The language matters through the framework conventions.',
  libreria: 'public API design, versioning, testing and packaging. Architecture matters as far as it shapes the API.',
  plugin: 'the plugin contract (manifest, hooks, skills, commands), lifecycle and extension points, permissions and safety. The language is secondary.',
  mcp: 'the protocol, tool schemas and input validation, transport, error handling and permissions. The language is secondary.',
  integracion: 'contracts with the other system, authentication, error and retry handling, data mapping and idempotency. The language is secondary.',
  script: 'language fundamentals, error handling and clear structure. Architecture barely matters.',
  infraestructura: 'declarative configuration, environments, secrets and security, reproducibility.',
  otro: 'whatever the code shows most clearly. Balance concepts and decisions.',
};

/* Where a concept lives. Universal ones are shared across every language and framework. */
const SCOPES = ['universal', 'lenguaje', 'framework', 'tipo'];

const home = () => process.env.LBD_HOME || path.join(os.homedir(), '.learn-by-doing');
const stateFile = () => path.join(home(), 'state.json');
const configFile = () => path.join(home(), 'config.json');

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const readConfig = () => readJson(configFile(), {});
const notesDir = () => process.env.LBD_NOTES || readConfig().notesDir || path.join(home(), 'notes');
const lessonsDir = () => path.join(notesDir(), 'lessons');

const readState = () => {
  const s = readJson(stateFile(), {});
  return { projects: s.projects || {}, sync: s.sync || {} };
};
const writeState = (s) => writeJson(stateFile(), s);

function readProfile() {
  const file = readJson(path.join(home(), 'profile.json'), {});
  const enabled = Array.isArray(file.modalities) ? file.modalities.filter((m) => MODALITIES[m]) : [];
  return {
    isDefault: enabled.length === 0,
    modalities: enabled.length ? enabled : DEFAULT_MODALITIES,
    known: Array.isArray(file.known) ? file.known : [],
    rusty: Array.isArray(file.rusty) ? file.rusty : [],
    level: file.level || null,
    language: file.language || null,
    emphasis: file.emphasis || {},
  };
}

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'proyecto';

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

module.exports = {
  FAMILIES, MODALITIES, DEFAULT_MODALITIES, KINDS, KIND_FOCUS, SCOPES,
  home, notesDir, lessonsDir, readJson, writeJson, readConfig, configFile,
  readState, writeState, readProfile, identify, git, slugify,
};
