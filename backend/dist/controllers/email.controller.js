import { z } from 'zod';
import { prisma } from '../services/db.service.js';
import { enqueueEmailJob, removeQueueJob } from '../services/queue.service.js';
import { indexEmailDocument, searchEmailDocuments } from '../services/search.service.js';
import { config } from '../config/env.js';
export const scheduleEmailSchema = z.object({
    senderEmail: z.string().email('Invalid sender email'),
    recipients: z.array(z.string().email('Invalid recipient email')).min(1, 'At least one recipient is required'),
    subject: z.string().min(1, 'Subject is required'),
    body: z.string().min(1, 'Body is required'),
    startTime: z.string().or(z.date()).optional(),
    delayBetweenEmails: z.number().int().min(0).optional().default(config.worker.minSendDelaySeconds),
    hourlyLimit: z.number().int().min(1).optional().default(config.worker.maxEmailsPerHourPerSender),
});
export async function scheduleEmails(req, res) {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const { senderEmail, recipients, subject, body, startTime, delayBetweenEmails, hourlyLimit, } = req.body;
    // Base starting time: specified time or immediately
    const baseTime = startTime ? new Date(startTime) : new Date();
    const delaySec = delayBetweenEmails ?? config.worker.minSendDelaySeconds;
    const limit = hourlyLimit ?? config.worker.maxEmailsPerHourPerSender;
    // Deduplicate recipient emails
    const uniqueRecipients = Array.from(new Set(recipients.map((r) => r.trim().toLowerCase())));
    const createdEmails = [];
    // Space out the scheduled times sequentially based on delayBetweenEmails
    for (let i = 0; i < uniqueRecipients.length; i++) {
        const recipient = uniqueRecipients[i];
        // Each subsequent recipient is scheduled baseTime + (i * delaySec seconds)
        const emailScheduledTime = new Date(baseTime.getTime() + i * delaySec * 1000);
        // 1. Persist to PostgreSQL (Single Source of Truth)
        const email = await prisma.email.create({
            data: {
                userId,
                senderEmail,
                recipientEmail: recipient,
                subject,
                body,
                scheduledTime: emailScheduledTime,
                delayBetweenEmails: delaySec,
                hourlyLimit: limit,
                status: 'SCHEDULED',
            },
        });
        // 2. Enqueue delayed job in BullMQ with jobId = email.id (Idempotency)
        const job = await enqueueEmailJob({
            emailId: email.id,
            userId,
            senderEmail,
            recipientEmail: recipient,
            subject,
            body,
            delayBetweenEmails: delaySec,
            hourlyLimit: limit,
        }, emailScheduledTime);
        // 3. Store jobId on DB row
        await prisma.email.update({
            where: { id: email.id },
            data: { jobId: job.id },
        });
        // 4. Index scheduled email into Elasticsearch
        await indexEmailDocument(email);
        createdEmails.push(email);
    }
    res.status(201).json({
        message: `Successfully scheduled ${createdEmails.length} emails`,
        count: createdEmails.length,
        emails: createdEmails,
    });
}
export async function getScheduledEmails(req, res) {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const skip = (page - 1) * limit;
    const [total, emails] = await Promise.all([
        prisma.email.count({
            where: {
                userId,
                status: { in: ['PENDING', 'SCHEDULED', 'PROCESSING'] },
            },
        }),
        prisma.email.findMany({
            where: {
                userId,
                status: { in: ['PENDING', 'SCHEDULED', 'PROCESSING'] },
            },
            orderBy: { scheduledTime: 'asc' },
            skip,
            take: limit,
        }),
    ]);
    res.json({
        total,
        page,
        limit,
        emails,
    });
}
export async function getSentEmails(req, res) {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const skip = (page - 1) * limit;
    const [total, emails] = await Promise.all([
        prisma.email.count({
            where: {
                userId,
                status: { in: ['SENT', 'FAILED'] },
            },
        }),
        prisma.email.findMany({
            where: {
                userId,
                status: { in: ['SENT', 'FAILED'] },
            },
            orderBy: { sentAt: 'desc' },
            skip,
            take: limit,
        }),
    ]);
    res.json({
        total,
        page,
        limit,
        emails,
    });
}
export async function searchEmails(req, res) {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const query = req.query.q || '';
    const status = req.query.status;
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    // 1. Query Elasticsearch index
    const esResult = await searchEmailDocuments({
        userId,
        query,
        status,
        page,
        limit,
    });
    // If Elasticsearch returned hits, return them
    if (esResult.total > 0 || (query && query.trim() !== '')) {
        res.json({
            source: 'elasticsearch',
            total: esResult.total,
            emails: esResult.items,
        });
        return;
    }
    // Fallback: Query PostgreSQL directly if Elasticsearch is empty or unavailable
    const whereClause = { userId };
    if (status) {
        whereClause.status = status;
    }
    if (query && query.trim() !== '') {
        whereClause.OR = [
            { subject: { contains: query, mode: 'insensitive' } },
            { body: { contains: query, mode: 'insensitive' } },
            { recipientEmail: { contains: query, mode: 'insensitive' } },
            { senderEmail: { contains: query, mode: 'insensitive' } },
        ];
    }
    const [dbTotal, dbEmails] = await Promise.all([
        prisma.email.count({ where: whereClause }),
        prisma.email.findMany({
            where: whereClause,
            orderBy: { scheduledTime: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
    ]);
    res.json({
        source: 'postgresql',
        total: dbTotal,
        emails: dbEmails,
    });
}
export async function cancelScheduledEmail(req, res) {
    const userId = req.user?.id;
    const emailId = req.params.id;
    if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const email = await prisma.email.findFirst({
        where: { id: emailId, userId },
    });
    if (!email) {
        res.status(404).json({ error: 'Email not found' });
        return;
    }
    if (email.status === 'SENT') {
        res.status(400).json({ error: 'Cannot cancel an email that has already been sent' });
        return;
    }
    // Remove from BullMQ
    await removeQueueJob(email.id);
    // Delete or mark cancelled in PostgreSQL
    await prisma.email.delete({
        where: { id: email.id },
    });
    res.json({ success: true, message: 'Scheduled email cancelled successfully' });
}
