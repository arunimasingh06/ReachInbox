import { prisma } from './db.service.js';
import { enqueueEmailJob, getQueueJob } from './queue.service.js';
/**
 * Restart Reconciler:
 * Runs on server boot to ensure zero job loss across server or Redis restarts.
 * Queries PostgreSQL for any PENDING or SCHEDULED emails (and orphaned PROCESSING emails),
 * checks BullMQ, and safely re-enqueues only those missing from the queue.
 */
export async function reconcileOnBoot() {
    console.log('[Reconciler] Starting startup persistence reconciliation...');
    let checked = 0;
    let reEnqueued = 0;
    let alreadyInQueue = 0;
    let orphansRecovered = 0;
    try {
        // 1. Recover orphaned PROCESSING records where worker might have crashed mid-send
        const orphanedEmails = await prisma.email.findMany({
            where: {
                status: 'PROCESSING',
                sentAt: null,
            },
        });
        for (const orphan of orphanedEmails) {
            // Revert status back to SCHEDULED so it can be safely picked up again
            await prisma.email.update({
                where: { id: orphan.id },
                data: { status: 'SCHEDULED' },
            });
            orphansRecovered++;
        }
        if (orphansRecovered > 0) {
            console.log(`[Reconciler] Recovered ${orphansRecovered} orphaned PROCESSING records back to SCHEDULED.`);
        }
        // 2. Query all unfinalized emails from PostgreSQL
        const pendingEmails = await prisma.email.findMany({
            where: {
                status: { in: ['PENDING', 'SCHEDULED'] },
            },
        });
        checked = pendingEmails.length;
        for (const email of pendingEmails) {
            // Check if job is already registered in BullMQ
            const existingJob = await getQueueJob(email.id);
            if (existingJob) {
                alreadyInQueue++;
                continue;
            }
            // Job is missing from BullMQ (e.g. Redis restart without snapshot or failure before enqueue)
            const jobData = {
                emailId: email.id,
                userId: email.userId,
                senderEmail: email.senderEmail,
                recipientEmail: email.recipientEmail,
                subject: email.subject,
                body: email.body,
                delayBetweenEmails: email.delayBetweenEmails,
                hourlyLimit: email.hourlyLimit,
            };
            await enqueueEmailJob(jobData, email.scheduledTime);
            reEnqueued++;
            console.log(`[Reconciler] Re-enqueued missing job ${email.id} (Scheduled for: ${email.scheduledTime.toISOString()})`);
        }
        console.log(`[Reconciler] Reconciliation complete: Checked=${checked}, Re-enqueued=${reEnqueued}, AlreadyPresent=${alreadyInQueue}, OrphansRecovered=${orphansRecovered}`);
        return { checked, reEnqueued, alreadyInQueue, orphansRecovered };
    }
    catch (error) {
        console.error('[Reconciler] Error during reconciliation:', error.message);
        throw error;
    }
}
