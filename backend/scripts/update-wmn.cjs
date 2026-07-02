#!/usr/bin/env node
// Atualiza o dataset do WhatsMyName a partir do repositório oficial.
// Uso: npm run wmn:update
const fs = require('fs');
const path = require('path');

const URL = 'https://raw.githubusercontent.com/WebBreacher/WhatsMyName/main/wmn-data.json';
const DEST = path.join(__dirname, '..', 'src', 'integrations', 'data', 'wmn-data.json');

(async () => {
  process.stdout.write(`Baixando ${URL} ...\n`);
  const res = await fetch(URL);
  if (!res.ok) {
    console.error(`Falha: HTTP ${res.status}`);
    process.exit(1);
  }
  const text = await res.text();
  const data = JSON.parse(text); // valida o JSON antes de gravar
  const n = Array.isArray(data.sites) ? data.sites.length : 0;
  fs.writeFileSync(DEST, text);
  console.log(`OK — ${n} sites gravados em ${DEST}`);
  console.log('Rebuild o backend (make up-build) para o dist pegar o arquivo novo.');
})();
