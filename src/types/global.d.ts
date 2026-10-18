// Global type declarations
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    PORT: string;
    HOST: string;
    DATABASE_PATH: string;

    // X OAuth App Credentials (get from developer.x.com)
    X_CLIENT_ID: string;
    X_CLIENT_SECRET: string; // Optional for PKCE public clients
    X_REDIRECT_URI: string;

    // Encryption key for storing tokens (32 bytes, base64)
    ENCRYPTION_KEY: string;

    // Session
    SESSION_SECRET: string;

    // Rate limiting
    RATE_LIMIT_WINDOW_MS: string;
    RATE_LIMIT_MAX_REQUESTS: string;

    // Logging
    LOG_LEVEL: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  }
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_APP_NAME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}