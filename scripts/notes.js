const crypto = require('crypto');

const LANG = { js: 'js', jsx: 'jsx', ts: 'ts', tsx: 'tsx', py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java', cs: 'csharp', php: 'php', sql: 'sql', css: 'css', html: 'html', json: 'json', sh: 'bash', md: 'markdown' };
const langOf = (file) => { const m = /\.([a-z0-9]+)$/i.exec(file || ''); return m ? LANG[m[1].toLowerCase()] || '' : ''; };

/* ---------- frontmatter: simple keys, JSON values (valid YAML flow style) ---------- */
function fmValue(v) {
  if (typeof v === 'string') {
    const plain = /^[A-Za-z][A-Za-z0-9_./@ -]*$/.test(v) && v.trim() === v && !/^(true|false|null)$/.test(v);
    return plain ? v : JSON.stringify(v);
  }
  return JSON.stringify(v === undefined ? null : v);
}
function fmParseValue(raw) {
  const t = raw.trim();
  if (t === '') return '';
  if (/^["[{]/.test(t) || /^(true|false|null|-?\d+(\.\d+)?)$/.test(t)) { try { return JSON.parse(t); } catch {} }
  return t;
}
function splitFrontmatter(text) {
  const src = text.replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(src);
  if (!m) return { data: {}, body: src };
  const data = {};
  for (const line of m[1].split('\n')) {
    const k = /^([A-Za-z_][A-Za-z0-9_]*):(.*)$/.exec(line);
    if (k) data[k[1]] = fmParseValue(k[2]);
  }
  return { data, body: src.slice(m[0].length) };
}
function joinFrontmatter(data, body) {
  const lines = Object.entries(data).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}: ${fmValue(v)}`);
  return `---\n${lines.join('\n')}\n---\n${body.startsWith('\n') ? body.slice(1) : body}`;
}

/* ---------- body helpers ---------- */
const esc = (t) => String(t).replace(/^#/gm, '\\#');
const unesc = (t) => t.replace(/^\\#/gm, '#');
const oneLine = (t) => String(t).replace(/\s*\n\s*/g, ' ').trim();
function fenceFor(text) { let f = '```'; while (text.includes(f)) f += '`'; return f; }
function codeBlock(c) {
  const f = fenceFor(c.text);
  return `${c.file ? `Archivo: \`${c.file}\`\n\n` : ''}${f}${langOf(c.file)}\n${c.text}\n${f}\n`;
}

function lessonToMarkdown(l) {
  const e = l.exercise;
  const fm = {
    id: l.id,
    type: l.type,
    area: l.area,
    project: l.project,
    projectName: l.projectName,
    commit: l.commit && l.commit.hash,
    commitMessage: l.commit && l.commit.message,
    commitDate: l.commit && l.commit.date,
    created: l.createdAt,
    modality: e.modality,
    scope: l.scope,
    kind: l.kind,
    languages: l.languages || [],
    frameworks: l.frameworks || [],
    related: l.related || [],
    appearances: l.appearances || [],
    example: l.example === true,
  };
  const out = [];
  out.push(`# ${oneLine(l.title)}\n`);
  out.push('## Contexto\n');
  out.push(`- **Qué se construía:** ${oneLine(l.context.building)}`);
  out.push(`- **Qué hace este fragmento:** ${oneLine(l.context.snippetRole)}`);
  out.push(`- **Qué aprenderás:** ${oneLine(l.context.learning)}\n`);
  out.push('## Código\n');
  out.push(codeBlock(l.code));
  out.push('## Predice\n');
  out.push(`${esc(l.predict)}\n`);
  out.push('## Concepto\n');
  out.push(`${esc(l.explain)}\n`);
  out.push('## Ejercicio\n');
  out.push(`**Modalidad:** ${e.modality}\n`);
  out.push(`${esc(e.prompt)}\n`);
  if (e.code) out.push(codeBlock(e.code));
  if (e.options) {
    out.push('### Opciones\n');
    out.push(e.options.map((o, i) => `- [${i === e.answer ? 'x' : ' '}] ${oneLine(o)}`).join('\n') + '\n');
    out.push('### Por qué\n');
    out.push(`${esc(e.why)}\n`);
  } else {
    out.push('### Puntos clave\n');
    out.push(e.keyPoints.map((k) => `- ${oneLine(k)}`).join('\n') + '\n');
    out.push('### Respuesta modelo\n');
    out.push(`${esc(e.modelAnswer)}\n`);
  }
  if (l.related && l.related.length) {
    out.push('## Relacionado\n');
    out.push(l.related.map((r) => `- [[${r}]]`).join('\n') + '\n');
  }
  return joinFrontmatter(fm, out.join('\n'));
}

/* split into [heading, lines] chunks at a given heading prefix, ignoring fenced code */
function chunks(lines, prefix) {
  const result = [{ heading: null, lines: [] }];
  let fence = null;
  for (const line of lines) {
    const open = /^(`{3,})/.exec(line);
    if (fence) { if (new RegExp('^' + fence + '`*\\s*$').test(line)) fence = null; }
    else if (open) fence = open[1];
    if (!fence && !open && line.startsWith(prefix) && !line.startsWith(prefix + '#')) result.push({ heading: line.slice(prefix.length).trim(), lines: [] });
    else result[result.length - 1].lines.push(line);
  }
  return result;
}
function takeCode(lines) {
  let file = '';
  let i = 0;
  const idx = lines.findIndex((l) => /^`{3,}/.test(l));
  if (idx === -1) return null;
  const pre = lines.slice(0, idx);
  const fm = /^Archivo: `(.+)`\s*$/.exec(pre.filter((l) => l.trim()).pop() || '');
  if (fm) file = fm[1];
  const fence = /^(`{3,})/.exec(lines[idx])[1];
  const body = [];
  for (i = idx + 1; i < lines.length; i++) {
    if (new RegExp('^' + fence + '`*\\s*$').test(lines[i])) break;
    body.push(lines[i]);
  }
  return { code: { file, text: body.join('\n') }, before: pre, after: lines.slice(i + 1), hadFile: !!fm };
}
const textOf = (lines) => unesc(lines.join('\n').trim());
const bullets = (lines) => lines.map((l) => /^- (.*)$/.exec(l)).filter(Boolean).map((m) => m[1].trim());

function markdownToLesson(text) {
  const { data, body } = splitFrontmatter(text);
  const lines = body.split('\n');
  const sections = chunks(lines, '## ');
  const titleLine = sections[0].lines.find((l) => /^# /.test(l));
  if (!titleLine) return { error: 'missing "# title"' };
  const sec = (name) => (sections.find((s) => s.heading === name) || {}).lines;
  const ctx = sec('Contexto'), code = sec('Código'), pred = sec('Predice'), expl = sec('Concepto'), ex = sec('Ejercicio'), rel = sec('Relacionado');
  if (!ctx || !code || !pred || !expl || !ex) return { error: 'missing one of: Contexto, Código, Predice, Concepto, Ejercicio' };

  const field = (label) => { const m = ctx.map((l) => new RegExp(`^- \\*\\*${label}:\\*\\* (.*)$`).exec(l)).find(Boolean); return m ? m[1].trim() : ''; };
  const context = { building: field('Qué se construía'), snippetRole: field('Qué hace este fragmento'), learning: field('Qué aprenderás') };
  const lessonCode = takeCode(code);
  if (!lessonCode) return { error: 'missing code block under "Código"' };

  const parts = chunks(ex, '### ');
  const head = parts[0].lines;
  const modLine = head.find((l) => /^\*\*Modalidad:\*\*/.test(l));
  const modality = modLine ? modLine.replace(/^\*\*Modalidad:\*\*/, '').trim() : data.modality;
  const rest = head.filter((l) => l !== modLine);
  const exCode = takeCode(rest);
  const prompt = textOf(exCode ? exCode.before.filter((l) => !/^Archivo: `/.test(l)) : rest);
  const exercise = { modality, prompt };
  if (exCode) exercise.code = exCode.code;
  const part = (name) => (parts.find((p) => p.heading === name) || {}).lines;
  const options = part('Opciones');
  if (options) {
    const items = options.map((l) => /^- \[( |x|X)\] (.*)$/.exec(l)).filter(Boolean);
    exercise.options = items.map((m) => m[2].trim());
    exercise.answer = items.findIndex((m) => m[1] !== ' ');
    exercise.why = textOf(part('Por qué') || []);
  } else {
    exercise.keyPoints = bullets(part('Puntos clave') || []);
    exercise.modelAnswer = textOf(part('Respuesta modelo') || []);
  }

  return {
    lesson: {
      id: data.id,
      createdAt: data.created || '',
      project: data.project || '',
      projectName: data.projectName || data.project || '',
      commit: { hash: data.commit || '', message: data.commitMessage || '', date: data.commitDate || '' },
      context,
      type: data.type,
      area: data.area,
      scope: data.scope || '',
      kind: data.kind || '',
      languages: Array.isArray(data.languages) ? data.languages : [],
      frameworks: Array.isArray(data.frameworks) ? data.frameworks : [],
      concept: data.id,
      title: titleLine.replace(/^# /, '').trim(),
      code: lessonCode.code,
      predict: textOf(pred),
      explain: textOf(expl),
      exercise,
      related: Array.isArray(data.related) ? data.related : rel ? [...textOf(rel).matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]) : [],
      appearances: Array.isArray(data.appearances) ? data.appearances : [],
      example: data.example === true,
    },
  };
}

const hashOf = (text) => crypto.createHash('sha1').update(text.replace(/\r\n/g, '\n')).digest('hex');

module.exports = { splitFrontmatter, joinFrontmatter, lessonToMarkdown, markdownToLesson, hashOf };
