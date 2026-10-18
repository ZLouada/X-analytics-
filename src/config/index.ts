import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_PATH: z.string().default('./data/x-analytics.db'),

  X_CLIENT_ID: z.string().min(1, 'X_CLIENT_ID is required'),
  X_CLIENT_SECRET: z.string().optional(),
  X_REDIRECT_URI: z.string().url('X_REDIRECT_URI must be a valid URL'),

  ENCRYPTION_KEY: z.string().min(44, 'ENCRYPTION_KEY must be 32 bytes base64 encoded (44 chars)'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

export type EnvConfig = z.infer<typeof envSchema>;

let cachedConfig: EnvConfig | null = null;

export function getConfig(): EnvConfig {
  if (cachedConfig) return cachedConfig;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${errors}`);
  }

  cachedConfig = result.data;
  return cachedConfig;
}

export function resetConfig() {
  cachedConfig = null;
}