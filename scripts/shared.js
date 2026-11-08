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
  FAMILIES, MODALITIES, DEFAULT_MODALITIES,
  home, notesDir, lessonsDir, readJson, writeJson, readConfig, configFile,
  readState, writeState, readProfile, identify, git, slugify,
};
