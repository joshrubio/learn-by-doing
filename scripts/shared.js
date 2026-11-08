const fs = require('fs');
const os = require('os');
const path = require('path');

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

function readProfile() {
  let file = {};
  try { file = JSON.parse(fs.readFileSync(path.join(home(), 'profile.json'), 'utf8')); } catch {}
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

module.exports = { FAMILIES, MODALITIES, DEFAULT_MODALITIES, home, readProfile };
