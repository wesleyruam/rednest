// Importa as chaves de provedores externos da v1 (~/.rednest/apikeys.json)
// para o banco da v2, criptografando com AES-256-GCM (mesmo esquema do app).
//
// Uso:  node prisma/import-provider-keys.cjs [caminho-do-json]
// Respeita DATABASE_URL e INTEGRATIONS_SECRET do ambiente.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

// Carrega variáveis do .env do backend, se ainda não estiverem no ambiente.
(function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    const k = m[1];
    let v = m[2].replace(/^["']|["']$/g, '');
    if (process.env[k] === undefined) process.env[k] = v;
  }
})();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const KNOWN = ['censys', 'abuseipdb', 'virustotal', 'otx', 'threatfox'];

function secret() {
  return (
    process.env.INTEGRATIONS_SECRET ||
    process.env.JWT_ACCESS_SECRET ||
    'rednest-default-integrations-secret'
  );
}

function encrypt(plaintext) {
  const key = crypto.scryptSync(secret(), 'rednest-provider-keys', 32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    encrypted: enc.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

async function main() {
  const jsonPath =
    process.argv[2] || path.join(os.homedir(), '.rednest', 'apikeys.json');
  if (!fs.existsSync(jsonPath)) {
    console.error(`Arquivo não encontrado: ${jsonPath}`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  let n = 0;
  for (const service of KNOWN) {
    const value = data[service];
    if (!value || !String(value).trim()) continue;
    const enc = encrypt(String(value).trim());
    await prisma.providerKey.upsert({
      where: { service },
      update: enc,
      create: { service, ...enc },
    });
    console.log(`✓ importada: ${service}`);
    n++;
  }
  console.log(`\n${n} chave(s) importada(s) da v1.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
