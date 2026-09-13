import { prisma } from '../src/services/db.service.js';
import { emailQueue, enqueueEmailJob } from '../src/services/queue.service.js';

async function runIdempotencyVerification(): Promise<void> {
  console.log('--- [VERIFICATION] Database-Level State Guard & BullMQ Deduplication ---');

  // 1. Create a dummy test user
  const user = await prisma.user.upsert({
    where: { email: 'idempotency-test@example.com' },
    update: {},
    create: {
      email: 'idempotency-test@example.com',
      name: 'Idempotency Tester',
    },
  });

  // 2. Create a test email in PostgreSQL
  const email = await prisma.email.create({
    data: {
      userId: user.id,
      senderEmail: 'sender@example.com',
      recipientEmail: 'recipient@example.com',
      subject: 'Idempotency Test Subject',
      body: 'Testing duplicate race conditions',
      scheduledTime: new Date(Date.now() + 60000), // 1 minute in the future
      status: 'SCHEDULED',
    },
  });

  console.log(`Created test email: ${email.id} (Status: ${email.status})`);

  // 3. Test Primary Idempotency Guard: Concurrent Database Status Transitions
  console.log('Simulating 5 concurrent workers attempting to claim the email simultaneously...');
  const claimAttempts = await Promise.all(
    Array.from({ length: 5 }).map(async (_, idx) => {
      const updateResult = await prisma.email.updateMany({
        where: {
          id: email.id,
          status: { in: ['PENDING', 'SCHEDULED'] },
        },
        data: {
          status: 'PROCESSING',
        },
      });
      return { workerIndex: idx + 1, claimed: updateResult.count === 1 };
    })
  );

  const successfulClaims = claimAttempts.filter((a) => a.claimed).length;
  console.log(`Claims result: ${successfulClaims} worker claimed successfully, ${5 - successfulClaims} rejected.`);

  if (successfulClaims !== 1) {
    throw new Error(`Idempotency guard FAILED: Expected exactly 1 claim, got ${successfulClaims}`);
  }

  // 4. Test Secondary Guard: BullMQ Job ID Deduplication
  console.log('Testing BullMQ Job ID deduplication...');
  const jobData = {
    emailId: email.id,
    userId: user.id,
    senderEmail: email.senderEmail,
    recipientEmail: email.recipientEmail,
    subject: email.subject,
    body: email.body,
    delayBetweenEmails: 2,
    hourlyLimit: 100,
  };

  const job1 = await enqueueEmailJob(jobData, email.scheduledTime);
  const job2 = await enqueueEmailJob(jobData, email.scheduledTime);

  if (job1.id !== job2.id) {
    throw new Error(`BullMQ deduplication FAILED: Job IDs differ (${job1.id} vs ${job2.id})`);
  }

  console.log(`✅ BullMQ deduplicated identical job IDs: ${job1.id}`);

  // Cleanup
  await emailQueue.remove(email.id);
  await prisma.email.delete({ where: { id: email.id } });

  console.log('✅ PASS: Primary DB guard and secondary BullMQ deduplication verified.');
}

export { runIdempotencyVerification };

if (import.meta.url === `file://${process.argv[1]}`) {
  runIdempotencyVerification()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
