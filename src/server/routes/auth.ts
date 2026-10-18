import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { XApiClient } from '@/api/x-api-client';
import { userRepo, tokenRepo, settingsRepo } from '@/storage/repositories';
import { encrypt, generateEncryptionKey } from '@/server/encryption';
import { logger } from '@/server/logger';
import { getConfig } from '@/config';

const router: Router = Router();

// In-memory PKCE storage (use Redis in production for multi-instance)
const pkceStore = new Map<string, { codeVerifier: string; state: string; createdAt: number }>();

// Cleanup old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pkceStore.entries()) {
    if (now - value.createdAt > 10 * 60 * 1000) {
      pkceStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

// ============================================
// GET /auth/login - Initiate OAuth flow
// ============================================
router.get('/login', (_req: Request, res: Response) => {
  try {
    const { url, codeVerifier, state } = XApiClient.generateAuthUrl();

    // Store PKCE parameters with a temporary key
    const sessionKey = randomBytes(16).toString('hex');
    pkceStore.set(sessionKey, { codeVerifier, state, createdAt: Date.now() });

    // Set session cookie
    res.cookie('pkce_session', sessionKey, {
      httpOnly: true,
      secure: getConfig().NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000, // 10 minutes
    });

    res.redirect(url);
  } catch (error) {
    logger.error({ error }, 'Failed to generate auth URL');
    res.status(500).json({ error: 'Failed to initiate authentication' });
  }
});

// ============================================
// GET /auth/callback - Handle OAuth callback
// ============================================
router.get('/callback', async (req: Request, res: Response) => {
  const sessionKey = req.cookies?.pkce_session;
  const { code, state, error: oauthError, error_description } = req.query;

  // Clear PKCE cookie
  res.clearCookie('pkce_session');

  if (!sessionKey || !pkceStore.has(sessionKey)) {
    logger.warn('Invalid or expired PKCE session');
    return res.redirect('/?error=invalid_session');
  }

  const pkceData = pkceStore.get(sessionKey)!;
  pkceStore.delete(sessionKey);

  if (oauthError) {
    logger.warn({ error: oauthError, description: error_description }, 'OAuth error');
    return res.redirect(`/?error=${encodeURIComponent(oauthError as string)}`);
  }

  if (!code || typeof code !== 'string') {
    return res.redirect('/?error=no_code');
  }

  if (state !== pkceData.state) {
    logger.warn('State mismatch');
    return res.redirect('/?error=state_mismatch');
  }

  try {
    // Exchange code for tokens
    const tokens = await XApiClient.exchangeCodeForTokens(code, pkceData.codeVerifier);

    // Create client to get user info
    const tempClient = new XApiClient('temp');
    tempClient['accessToken'] = tokens.access_token; // Access private for initial user fetch

    const user = await tempClient.getMe();

    // Encrypt and store tokens
    const [accessTokenEnc, refreshTokenEnc] = await Promise.all([
      encrypt(tokens.access_token),
      encrypt(tokens.refresh_token),
    ]);

    const expiresAt = Date.now() + tokens.expires_in * 1000;

    tokenRepo.upsert({
      user_id: user.id,
      access_token_encrypted: accessTokenEnc,
      refresh_token_encrypted: refreshTokenEnc,
      expires_at: expiresAt,
      token_type: tokens.token_type,
      scope: tokens.scope,
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    // Upsert user
    userRepo.upsert({
      id: user.id,
      username: user.username,
      name: user.name,
      profile_image_url: user.profile_image_url || null,
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    // Create default settings
    const defaultSettings = settingsRepo.getDefaults();
    defaultSettings.user_id = user.id;
    settingsRepo.upsert(defaultSettings);

    // Set auth cookie
    res.cookie('auth_user', user.id, {
      httpOnly: true,
      secure: getConfig().NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    logger.info({ userId: user.id, username: user.username }, 'User authenticated successfully');
    res.redirect('/?auth=success');
  } catch (error) {
    logger.error({ error }, 'OAuth callback failed');
    res.redirect(`/?error=${encodeURIComponent((error as Error).message)}`);
  }
});

// ============================================
// POST /auth/logout - Logout user
// ============================================
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('auth_user');
  res.json({ success: true });
});

// ============================================
// GET /auth/status - Check auth status
// ============================================
router.get('/status', (req: Request, res: Response) => {
  const userId = req.cookies?.auth_user;

  if (!userId) {
    return res.json({ authenticated: false });
  }

  const user = userRepo.getById(userId);
  const tokens = tokenRepo.getByUserId(userId);

  if (!user || !tokens) {
    res.clearCookie('auth_user');
    return res.json({ authenticated: false });
  }

  res.json({
    authenticated: true,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      profile_image_url: user.profile_image_url,
    },
    tokenExpiresAt: tokens.expires_at,
  });
});

export default router;