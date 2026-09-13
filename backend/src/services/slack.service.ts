import axios from 'axios';
import { config } from '../config/env.js';
import { prisma } from './db.service.js';

export function getSlackAuthorizeUrl(userId: string): string {
  if (!config.slack.clientId) {
    throw new Error('SLACK_CLIENT_ID is not configured in backend environment');
  }

  const scopes = ['incoming-webhook', 'chat:write'].join(',');
  const params = new URLSearchParams({
    client_id: config.slack.clientId,
    scope: scopes,
    redirect_uri: config.slack.redirectUri,
    state: userId,
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export async function handleSlackOAuthCallback(code: string, userId: string): Promise<any> {
  if (!config.slack.clientId || !config.slack.clientSecret) {
    throw new Error('Slack OAuth credentials not configured in backend');
  }

  const response = await axios.post(
    'https://slack.com/api/oauth.v2.access',
    new URLSearchParams({
      client_id: config.slack.clientId,
      client_secret: config.slack.clientSecret,
      code,
      redirect_uri: config.slack.redirectUri,
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  const data = response.data;
  if (!data.ok) {
    throw new Error(`Slack OAuth failed: ${data.error}`);
  }

  const teamId = data.team?.id;
  const teamName = data.team?.name;
  const accessToken = data.access_token;
  const webhookUrl = data.incoming_webhook?.url;
  const channel = data.incoming_webhook?.channel;
  const channelId = data.incoming_webhook?.channel_id;

  // Persist or update Slack integration for this user in PostgreSQL
  const integration = await prisma.slackIntegration.upsert({
    where: { userId },
    update: {
      teamId,
      teamName,
      accessToken,
      incomingWebhookUrl: webhookUrl,
      channel,
      channelId,
    },
    create: {
      userId,
      teamId,
      teamName,
      accessToken,
      incomingWebhookUrl: webhookUrl,
      channel,
      channelId,
    },
  });

  console.log(`[SlackService] Successfully connected Slack for user ${userId} (Team: ${teamName})`);
  return integration;
}

/**
 * Dispatch a live Slack notification when a sender hits their hourly limit.
 * Reads token/webhook directly from PostgreSQL at execution time so changes take effect immediately.
 */
export async function sendSlackRateLimitNotification(
  userId: string,
  senderEmail: string,
  hourlyLimit: number,
  nextHourTime: Date
): Promise<boolean> {
  try {
    const integration = await prisma.slackIntegration.findUnique({
      where: { userId },
    });

    if (!integration) {
      console.log(`[SlackService] User ${userId} has not connected Slack. Skipping notification silently.`);
      return false;
    }

    const formattedNextHour = nextHourTime.toISOString();
    const messagePayload = {
      text: `⚠️ Rate limit exceeded for sender ${senderEmail}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '⚠️ Email Sender Rate Limit Exceeded',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Sender:*\n\`${senderEmail}\``,
            },
            {
              type: 'mrkdwn',
              text: `*Hourly Cap:*\n*${hourlyLimit}* emails/hr`,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Action Taken:* Remaining jobs have been safely postponed to the next available hour window at *${formattedNextHour}* without losing priority or dropping requests.`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `ReachInbox Distributed Scheduler • ${new Date().toLocaleTimeString()}`,
            },
          ],
        },
      ],
    };

    if (integration.incomingWebhookUrl) {
      await axios.post(integration.incomingWebhookUrl, messagePayload);
      console.log(`[SlackService] Live Slack notification sent via incoming webhook to user ${userId}`);
      return true;
    } else if (integration.accessToken && integration.channelId) {
      await axios.post(
        'https://slack.com/api/chat.postMessage',
        {
          channel: integration.channelId,
          ...messagePayload,
        },
        {
          headers: {
            Authorization: `Bearer ${integration.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log(`[SlackService] Live Slack notification sent via chat.postMessage to channel ${integration.channelId}`);
      return true;
    }

    return false;
  } catch (error: any) {
    console.error('[SlackService] Error sending Slack notification:', error.message);
    return false;
  }
}
