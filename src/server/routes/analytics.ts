import { Router, Request, Response } from 'express';
import { AnalyticsEngine } from '@/analytics/engine';
import { exportToJson, exportToCsv, exportToPdf, exportAllData } from '@/export/exporter';
import { userRepo, tweetRepo, followerRepo, analyticsRepo, settingsRepo } from '@/storage/repositories';
import { syncUserProfile, syncUserTweets, syncFollowers } from '@/api/x-api-client';
import { logger } from '@/server/logger';
import { getConfig } from '@/config';

const router: Router = Router();

// ============================================
// Authentication Middleware
// ============================================
function requireAuth(req: Request, res: Response, next: Function) {
  const userId = req.cookies?.auth_user;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const user = userRepo.getById(userId);
  if (!user) {
    res.clearCookie('auth_user');
    return res.status(401).json({ error: 'User not found' });
  }
  req.userId = userId;
  next();
}

// Extend Request type
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

// ============================================
// GET /api/analytics/report - Generate analytics report
// ============================================
router.get('/report', requireAuth, async (req: Request, res: Response) => {
  try {
    const { period = '30d', start, end } = req.query;
    const userId = req.userId!;

    let periodStart: number;
    let periodEnd: number = Date.now();

    if (start && end) {
      periodStart = parseInt(start as string, 10);
      periodEnd = parseInt(end as string, 10);
    } else {
      const dayMs = 24 * 60 * 60 * 1000;
      switch (period) {
        case '7d': periodStart = periodEnd - 7 * dayMs; break;
        case '30d': periodStart = periodEnd - 30 * dayMs; break;
        case '90d': periodStart = periodEnd - 90 * dayMs; break;
        default: periodStart = periodEnd - 30 * dayMs;
      }
    }

    const engine = new AnalyticsEngine(userId);
    const report = await engine.generateReport(periodStart, periodEnd);

    res.json(report);
  } catch (error) {
    logger.error({ error, userId: req.userId }, 'Failed to generate report');
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ============================================
// GET /api/analytics/quick-stats - Quick dashboard stats
// ============================================
router.get('/quick-stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const engine = new AnalyticsEngine(userId);
    const stats = await engine.getQuickStats();
    res.json(stats);
  } catch (error) {
    logger.error({ error, userId: req.userId }, 'Failed to get quick stats');
    res.status(500).json({ error: 'Failed to get quick stats' });
  }
});

// ============================================
// GET /api/analytics/tweets - Get tweets with pagination
// ============================================
router.get('/tweets', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    const tweets = tweetRepo.getByUserId(userId, limit, offset);
    const total = tweetRepo.getCountByUserId(userId);

    res.json({
      tweets: tweets.map(t => ({
        id: t.id,
        text: t.text,
        created_at: t.created_at,
        public_metrics: JSON.parse(t.public_metrics),
        conversation_id: t.conversation_id,
        lang: t.lang,
      })),
      pagination: { limit, offset, total },
    });
  } catch (error) {
    logger.error({ error, userId: req.userId }, 'Failed to get tweets');
    res.status(500).json({ error: 'Failed to get tweets' });
  }
});

// ============================================
// GET /api/analytics/followers - Get followers with pagination
// ============================================
router.get('/followers', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;

    const followers = followerRepo.getByUserId(userId, limit, offset);
    const total = followerRepo.getCountByUserId(userId);

    res.json({
      followers: followers.map(f => ({
        id: f.follower_id,
        username: f.follower_username,
        name: f.follower_name,
        description: f.follower_description,
        profile_image_url: f.follower_profile_image_url,
        verified: f.follower_verified,
        location: f.follower_location,
        url: f.follower_url,
        protected: f.follower_protected,
        public_metrics: f.follower_public_metrics ? JSON.parse(f.follower_public_metrics) : null,
      })),
      pagination: { limit, offset, total },
    });
  } catch (error) {
    logger.error({ error, userId: req.userId }, 'Failed to get followers');
    res.status(500).json({ error: 'Failed to get followers' });
  }
});

// ============================================
// POST /api/analytics/sync - Trigger data sync
// ============================================
router.post('/sync', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { type = 'all' } = req.body;

    const results: Record<string, number> = {};

    if (type === 'all' || type === 'profile') {
      await syncUserProfile(userId);
      results.profile = 1;
    }

    if (type === 'all' || type === 'tweets') {
      results.tweets = await syncUserTweets(userId);
    }

    if (type === 'all' || type === 'followers') {
      results.followers = await syncFollowers(userId);
    }

    res.json({ success: true, results });
  } catch (error) {
    logger.error({ error, userId: req.userId }, 'Sync failed');
    res.status(500).json({ error: 'Sync failed', details: (error as Error).message });
  }
});

// ============================================
// GET /api/analytics/export - Export report
// ============================================
router.get('/export', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { format = 'json', period = '30d', start, end } = req.query;

    let periodStart: number;
    let periodEnd: number = Date.now();

    if (start && end) {
      periodStart = parseInt(start as string, 10);
      periodEnd = parseInt(end as string, 10);
    } else {
      const dayMs = 24 * 60 * 60 * 1000;
      switch (period) {
        case '7d': periodStart = periodEnd - 7 * dayMs; break;
        case '30d': periodStart = periodEnd - 30 * dayMs; break;
        case '90d': periodStart = periodEnd - 90 * dayMs; break;
        default: periodStart = periodEnd - 30 * dayMs;
      }
    }

    const engine = new AnalyticsEngine(userId);
    const report = await engine.generateReport(periodStart, periodEnd);

    const user = userRepo.getById(userId);
    const username = user?.username || 'user';
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `x-analytics-${username}-${dateStr}`;

    if (format === 'csv') {
      const csv = exportToCsv(report);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send(csv);
    }

    if (format === 'pdf') {
      const pdf = await exportToPdf(report);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      return res.send(pdf);
    }

    // Default: JSON
    const json = exportToJson(report);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
    res.send(json);
  } catch (error) {
    logger.error({ error, userId: req.userId }, 'Export failed');
    res.status(500).json({ error: 'Export failed' });
  }
});

// ============================================
// GET /api/analytics/export/all - Export all data
// ============================================
router.get('/export/all', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { format = 'json' } = req.query;

    const user = userRepo.getById(userId);
    const username = user?.username || 'user';
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `x-analytics-full-${username}-${dateStr}`;

    const data = await exportAllData(userId, format as 'json' | 'csv' | 'pdf');

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send(data as string);
    }

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      return res.send(data as Buffer);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
    res.send(data as string);
  } catch (error) {
    logger.error({ error, userId: req.userId }, 'Full export failed');
    res.status(500).json({ error: 'Full export failed' });
  }
});

// ============================================
// GET /api/analytics/history - Get historical snapshots
// ============================================
router.get('/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);

    const snapshots = analyticsRepo.getHistory(userId, limit);
    res.json(snapshots);
  } catch (error) {
    logger.error({ error, userId: req.userId }, 'Failed to get history');
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// ============================================
// GET /api/analytics/settings - Get user settings
// ============================================
router.get('/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const settings = settingsRepo.get(userId) || settingsRepo.getDefaults();
    res.json(settings);
  } catch (error) {
    logger.error({ error, userId: req.userId }, 'Failed to get settings');
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// ============================================
// PUT /api/analytics/settings - Update user settings
// ============================================
router.put('/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const updates = req.body;

    const current = settingsRepo.get(userId) || settingsRepo.getDefaults();
    current.user_id = userId;

    const allowedFields = [
      'timezone', 'date_format', 'auto_refresh_enabled',
      'auto_refresh_interval_minutes', 'data_retention_days', 'export_format'
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        (current as unknown as Record<string, unknown>)[field] = updates[field];
      }
    }

    current.updated_at = Date.now();
    settingsRepo.upsert(current);

    res.json(current);
  } catch (error) {
    logger.error({ error, userId: req.userId }, 'Failed to update settings');
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;