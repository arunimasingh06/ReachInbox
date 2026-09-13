import { Queue } from 'bullmq';
import { redisConnectionOptions } from '../config/redis.js';
export const EMAIL_QUEUE_NAME = 'email-queue';
export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
    connection: redisConnectionOptions,
    defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000,
        },
    },
});
/**
 * Enqueue an email to BullMQ with delayed scheduling and strict deduplication.
 * BullMQ uses the DB row's email.id as the BullMQ jobId to guarantee idempotency.
 */
export async function enqueueEmailJob(jobData, scheduledTime) {
    const targetTime = new Date(scheduledTime).getTime();
    const now = Date.now();
    const delay = Math.max(0, targetTime - now);
    const job = await emailQueue.add('send-email', jobData, {
        jobId: jobData.emailId, // CRITICAL: DB row ID is used as BullMQ job ID
        delay,
    });
    return job;
}
/**
 * Check if a job already exists in BullMQ by its ID (DB email row ID).
 */
export async function getQueueJob(jobId) {
    return emailQueue.getJob(jobId);
}
/**
 * Remove an existing job from the queue if needed.
 */
export async function removeQueueJob(jobId) {
    const job = await emailQueue.getJob(jobId);
    if (job) {
        await job.remove();
    }
}
