import { prisma } from '../src/services/db.service.js';
import { emailQueue, enqueueEmailJob, getQueueJob } from '../src/services/queue.service.js';
import { reconcileOnBoot } from '../src/services/reconciler.service.js';

async function runReconciliationVerification(): Promise<void> {
  console.log('--- [VERIFICATION] Server Restart Reconciliation & Persistence ---');

  // 1. Create a test user
  const user = await prisma.user.upsert({
    where: { email: 'reconcile-test@example.com' },
    update: {},
    create: {
      email: 'reconcile-test@example.com',
      name: 'Reconciliation Tester',
    },
  });

  const now = Date.now();

  // 2. Create 3 scheduled emails in PostgreSQL
  const email1 = await prisma.email.create({
    data: {
      userId: user.id,
      senderEmail: 'test@domain.io',
      recipientEmail: 'recip1@domain.io',
      subject: 'Reconcile 1',
      body: 'Body 1',
      scheduledTime: new Date(now + 120000),
      status: 'SCHEDULED',
    },
  });

  const email2 = await prisma.email.create({
    data: {
      userId: user.id,
      senderEmail: 'test@domain.io',
      recipientEmail: 'recip2@domain.io',
      subject: 'Reconcile 2',
      body: 'Body 2',
      scheduledTime: new Date(now + 180000),
      status: 'SCHEDULED',
    },
  });

  const email3Orphan = await prisma.email.create({
    data: {
      userId: user.id,
      senderEmail: 'test@domain.io',
      recipientEmail: 'recip3@domain.io',
      subject: 'Reconcile 3 Orphan',
      body: 'Body 3',
      scheduledTime: new Date(now + 240000),
      status: 'PROCESSING', // Simulates worker dying mid-flight
      sentAt: null,
    },
  });

  console.log(`Created test records in PostgreSQL: email1=${email1.id}, email2=${email2.id}, email3(orphan)=${email3Orphan.id}`);

  // Only enqueue email1 into BullMQ; leave email2 and email3 missing
  await enqueueEmailJob(
    {
      emailId: email1.id,
      userId: user.id,
      senderEmail: email1.senderEmail,
      recipientEmail: email1.recipientEmail,
      subject: email1.subject,
      body: email1.body,
      delayBetweenEmails: 2,
      hourlyLimit: 100,
    },
    email1.scheduledTime
  );

  console.log('State before reconciliation: email1 in BullMQ; email2 & email3 missing from BullMQ.');

  // 3. Run reconciliation
  const stats = await reconcileOnBoot();
  console.log('Reconciliation run returned:', stats);

  if (stats.orphansRecovered < 1) {
    throw new Error(`Expected at least 1 orphan recovered, got ${stats.orphansRecovered}`);
  }

  if (stats.reEnqueued < 2) {
    throw new Error(`Expected at least 2 missing jobs re-enqueued, got ${stats.reEnqueued}`);
  }

  // 4. Verify all 3 jobs exist in BullMQ
  const job1 = await getQueueJob(email1.id);
  const job2 = await getQueueJob(email2.id);
  const job3 = await getQueueJob(email3Orphan.id);

  if (!job1 || !job2 || !job3) {
    throw new Error(
      `Reconciliation verification FAILED: Missing jobs in BullMQ (job1=${!!job1}, job2=${!!job2}, job3=${!!job3})`
    );
  }

  console.log('✅ All 3 jobs verified in BullMQ after reconciliation.');

  // 5. Run reconciliation again to verify idempotency (should re-enqueue 0)
  const secondPass = await reconcileOnBoot();
  console.log('Second pass stats:', secondPass);
  if (secondPass.reEnqueued !== 0) {
    throw new Error(`Idempotency FAILED: Second reconciliation pass re-enqueued ${secondPass.reEnqueued} jobs`);
  }

  console.log('✅ Second pass verified zero duplicate enqueues.');

  // Cleanup
  await emailQueue.remove(email1.id);
  await emailQueue.remove(email2.id);
  await emailQueue.remove(email3Orphan.id);
  await prisma.email.deleteMany({
    where: { id: { in: [email1.id, email2.id, email3Orphan.id] } },
  });

  console.log('✅ PASS: Startup persistence reconciliation fully verified.');
}

export { runReconciliationVerification };

if (import.meta.url === `file://${process.argv[1]}`) {
  runReconciliationVerification()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
