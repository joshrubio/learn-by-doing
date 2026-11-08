#!/usr/bin/env node
/* Copies the catalog into the study space page, between the CATALOG markers.
   node scripts/sync-catalog.js          rewrite site/index.html
   node scripts/sync-catalog.js --check  exit 1 if the page is out of date */
const fs = require('fs');
const path = require('path');
const { BRANCHES, NODES } = require('./catalog');

const page = path.join(__dirname, '..', 'site', 'index.html');
const START = '/*CATALOG:START*/';
const END = '/*CATALOG:END*/';
const block = `${START}const CATALOG=${JSON.stringify({ branches: BRANCHES, nodes: NODES })};${END}`;

const html = fs.readFileSync(page, 'utf8');
const i = html.indexOf(START);
const j = html.indexOf(END);
if (i < 0 || j < 0) { console.error('catalog markers not found in site/index.html'); process.exit(1); }
const next = html.slice(0, i) + block + html.slice(j + END.length);

if (process.argv.includes('--check')) {
  if (next !== html) { console.error('site/index.html is out of date, run node scripts/sync-catalog.js'); process.exit(1); }
  console.log('catalog in the page is up to date');
} else {
  fs.writeFileSync(page, next);
  console.log(`catalog written to the page (${NODES.length} concepts, ${BRANCHES.length} branches)`);
}
