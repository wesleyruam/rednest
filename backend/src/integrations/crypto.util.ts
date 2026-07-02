import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';

const ALGO = 'aes-256-gcm';

function keyFromSecret(secret: string): Buffer {
  // Deriva uma chave de 32 bytes estável a partir do segredo do app.
  return scryptSync(secret, 'rednest-provider-keys', 32);
}

export interface Encrypted {
  encrypted: string;
  iv: string;
  tag: string;
}

export function encryptSecret(plaintext: string, secret: string): Encrypted {
  const iv = randomBytes(12);
  const key = keyFromSecret(secret);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    encrypted: enc.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

export function decryptSecret(data: Encrypted, secret: string): string {
  const key = keyFromSecret(secret);
  const decipher = createDecipheriv(ALGO, key, Buffer.from(data.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(data.tag, 'base64'));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(data.encrypted, 'base64')),
    decipher.final(),
  ]);
  return dec.toString('utf8');
}

/** Versão mascarada para exibir na UI sem vazar a chave. */
export function maskKey(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 8) return '•'.repeat(value.length);
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}
