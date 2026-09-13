import { getSlackAuthorizeUrl, handleSlackOAuthCallback } from '../services/slack.service.js';
import { prisma } from '../services/db.service.js';
import { config } from '../config/env.js';
export async function startSlackOAuth(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'User must be authenticated to connect Slack' });
            return;
        }
        const authorizeUrl = getSlackAuthorizeUrl(userId);
        res.json({ url: authorizeUrl });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}
export async function slackOAuthCallback(req, res) {
    const { code, state, error } = req.query;
    if (error) {
        console.error('[SlackController] OAuth callback returned error:', error);
        res.redirect(`${config.frontendUrl}/?slack_error=${encodeURIComponent(String(error))}`);
        return;
    }
    if (!code || !state) {
        res.status(400).send('Missing code or state parameter');
        return;
    }
    try {
        const userId = String(state);
        await handleSlackOAuthCallback(String(code), userId);
        // Redirect to frontend dashboard with success notification query param
        res.redirect(`${config.frontendUrl}/?slack=connected`);
    }
    catch (err) {
        console.error('[SlackController] Failed to exchange Slack code:', err.message);
        res.redirect(`${config.frontendUrl}/?slack_error=${encodeURIComponent(err.message)}`);
    }
}
export async function getSlackStatus(req, res) {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
    }
    const integration = await prisma.slackIntegration.findUnique({
        where: { userId },
        select: {
            teamName: true,
            channel: true,
            updatedAt: true,
        },
    });
    res.json({
        connected: !!integration,
        details: integration || null,
    });
}
export async function disconnectSlack(req, res) {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
    }
    await prisma.slackIntegration.deleteMany({
        where: { userId },
    });
    res.json({ success: true, message: 'Slack disconnected successfully' });
}
