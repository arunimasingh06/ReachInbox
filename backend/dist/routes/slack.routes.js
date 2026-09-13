import { Router } from 'express';
import { startSlackOAuth, slackOAuthCallback, getSlackStatus, disconnectSlack, } from '../controllers/slack.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
const router = Router();
// OAuth callback from Slack (needs to be accessible without user JWT header)
router.get('/oauth/callback', slackOAuthCallback);
// Protected routes
router.get('/status', requireAuth, getSlackStatus);
router.get('/oauth/start', requireAuth, startSlackOAuth);
router.post('/disconnect', requireAuth, disconnectSlack);
export default router;
