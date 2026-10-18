import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';
import { getConfig } from '@/config';

const scryptAsync = promisify(scrypt);

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM recommended IV length
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;
const TAG_LENGTH = 16;

let cachedKey: Buffer | null = null;

async function getEncryptionKey(): Promise<Buffer> {
  if (cachedKey) return cachedKey;

  const config = getConfig();
  const keyBuffer = Buffer.from(config.ENCRYPTION_KEY, 'base64');

  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(`ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (base64 encoded), got ${keyBuffer.length}`);
  }

  cachedKey = keyBuffer;
  return cachedKey;
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: salt:iv:ciphertext:authTag (all base64)
  // We don't use salt here since key is pre-derived, but keep format for future
  return [
    Buffer.alloc(0).toString('base64'), // placeholder for salt
    iv.toString('base64'),
    ciphertext.toString('base64'),
    authTag.toString('base64'),
  ].join(':');
}

export async function decrypt(encrypted: string): Promise<string> {
  const key = await getEncryptionKey();
  const parts = encrypted.split(':');

  if (parts.length !== 4) {
    throw new Error('Invalid encrypted format');
  }

  const [, ivB64, ciphertextB64, authTagB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

export async function generateEncryptionKey(): Promise<string> {
  const key = randomBytes(KEY_LENGTH);
  return key.toString('base64');
}