import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config/env.js';
import { prisma } from '../services/db.service.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

const googleClient = new OAuth2Client(config.google.clientId);

export const googleAuthSchema = z.object({
  idToken: z.string().min(1, 'Google ID token is required'),
});

export async function googleLogin(req: Request, res: Response): Promise<void> {
  try {
    const { idToken } = req.body;

    if (!config.google.clientId) {
      res.status(500).json({ error: 'Google Client ID not configured on backend' });
      return;
    }

    // Verify Google ID Token using official Google OAuth2Client
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: config.google.clientId,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      res.status(400).json({ error: 'Invalid Google token payload' });
      return;
    }

    const { email, name, picture, sub: googleId } = payload;

    // Upsert user in PostgreSQL
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name: name || undefined,
        avatar: picture || undefined,
        googleId,
      },
      create: {
        email,
        name: name || null,
        avatar: picture || null,
        googleId,
      },
    });

    // Ensure default sender exists for this user
    await prisma.sender.upsert({
      where: {
        userId_email: {
          userId: user.id,
          email: user.email,
        },
      },
      update: {},
      create: {
        userId: user.id,
        email: user.email,
        name: user.name,
      },
    });

    // Generate JWT session token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    });
  } catch (error: any) {
    console.error('[Auth] Google OAuth verification error:', error.message);
    res.status(401).json({ error: `Authentication failed: ${error.message}` });
  }
}

export async function getCurrentUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      senders: true,
      slackIntegration: {
        select: {
          teamName: true,
          channel: true,
          updatedAt: true,
        },
      },
    },
  });

  res.json({ user });
}
