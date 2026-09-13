import { Worker, Job } from 'bullmq';
import { redisConnectionOptions } from '../config/redis.js';
import { config } from '../config/env.js';
import { EMAIL_QUEUE_NAME, enqueueEmailJob } from './queue.service.js';
import { prisma } from './db.service.js';
import {
  checkAndIncrementHourlyLimit,
  checkSenderMinDelay,
  recordSenderSentTimestamp,
  getStartOfNextHourWindow,
} from './ratelimit.service.js';
import { sendEmail } from './email.service.js';
import { sendSlackRateLimitNotification } from './slack.service.js';
import { indexEmailDocument } from './search.service.js';
import { EmailJobData } from '../types/index.js';

let workerInstance: Worker<EmailJobData> | null = null;

export function createEmailWorker(): Worker<EmailJobData> {
  if (workerInstance) return workerInstance;

  console.log(
    `[Worker] Initializing BullMQ Worker on queue "${EMAIL_QUEUE_NAME}" with concurrency=${config.worker.concurrency}`
  );

  workerInstance = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobData>) => {
      const { emailId, userId, senderEmail, recipientEmail, subject, body, delayBetweenEmails, hourlyLimit } =
        job.data;

      console.log(`[Worker] Processing job ${job.id} for email ${emailId} -> ${recipientEmail}`);

      // -------------------------------------------------------------
      // 1. PRIMARY IDEMPOTENCY GUARD (Database State Transition)
      // -------------------------------------------------------------
      const updated = await prisma.email.updateMany({
        where: {
          id: emailId,
          status: { in: ['PENDING', 'SCHEDULED'] },
        },
        data: {
          status: 'PROCESSING',
        },
      });

      if (updated.count === 0) {
        console.log(`[Worker] Email ${emailId} already claimed by another worker or finalized. Aborting.`);
        return;
      }

      // -------------------------------------------------------------
      // 2. PER-SENDER MINIMUM SEND DELAY THROTTLE
      // -------------------------------------------------------------
      const minDelaySec = delayBetweenEmails || config.worker.minSendDelaySeconds;
      const delayCheck = await checkSenderMinDelay(senderEmail, minDelaySec);

      if (!delayCheck.allowed) {
        console.log(
          `[Worker] Sender ${senderEmail} requires minimum ${minDelaySec}s spacing. Waiting ${delayCheck.waitTimeMs}ms...`
        );

        // Reset status to SCHEDULED in PostgreSQL
        await prisma.email.update({
          where: { id: emailId },
          data: { status: 'SCHEDULED' },
        });

        // Delay and re-enqueue for the remaining wait duration
        const targetResume = new Date(Date.now() + delayCheck.waitTimeMs);
        await enqueueEmailJob(job.data, targetResume);
        return;
      }

      // -------------------------------------------------------------
      // 3. ATOMIC PER-SENDER HOURLY RATE LIMITING (Redis Lua Script)
      // -------------------------------------------------------------
      const effectiveLimit = hourlyLimit || config.worker.maxEmailsPerHourPerSender;
      const rateCheck = await checkAndIncrementHourlyLimit(senderEmail, effectiveLimit);

      if (!rateCheck.allowed) {
        console.log(
          `[Worker] ⚠️ Sender ${senderEmail} exceeded hourly limit (${rateCheck.currentCount}/${effectiveLimit}). Rescheduling.`
        );

        const nextHour = getStartOfNextHourWindow();

        // Update DB status back to SCHEDULED with postponed time
        const rescheduledEmail = await prisma.email.update({
          where: { id: emailId },
          data: {
            status: 'SCHEDULED',
            scheduledTime: nextHour,
          },
        });

        // Re-enqueue job for start of next hour window
        await enqueueEmailJob(job.data, nextHour);

        // Update Elasticsearch index
        await indexEmailDocument(rescheduledEmail);

        // Trigger live Slack notification
        await sendSlackRateLimitNotification(userId, senderEmail, effectiveLimit, nextHour);
        return;
      }

      // -------------------------------------------------------------
      // 4. DISPATCH EMAIL VIA ETHEREAL SMTP
      // -------------------------------------------------------------
      try {
        const sendResult = await sendEmail({
          from: senderEmail,
          to: recipientEmail,
          subject,
          html: body,
        });

        // Record last sent timestamp for this sender
        await recordSenderSentTimestamp(senderEmail);

        // Finalize state in PostgreSQL (Single Source of Truth)
        const finalized = await prisma.email.update({
          where: { id: emailId },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            etherealMessageId: sendResult.messageId,
            etherealPreviewUrl: sendResult.previewUrl || null,
          },
        });

        // Index final state into Elasticsearch
        await indexEmailDocument(finalized);

        console.log(`[Worker] ✅ Successfully dispatched email ${emailId} to ${recipientEmail}`);
      } catch (smtpErr: any) {
        console.error(`[Worker] ❌ SMTP send failed for email ${emailId}:`, smtpErr.message);

        const failed = await prisma.email.update({
          where: { id: emailId },
          data: {
            status: 'FAILED',
            error: smtpErr.message,
          },
        });

        await indexEmailDocument(failed);
        throw smtpErr;
      }
    },
    {
      connection: redisConnectionOptions,
      concurrency: config.worker.concurrency,
    }
  );

  workerInstance.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed successfully.`);
  });

  workerInstance.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  return workerInstance;
}

export async function stopEmailWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
    console.log('[Worker] BullMQ Worker stopped gracefully.');
  }
}
