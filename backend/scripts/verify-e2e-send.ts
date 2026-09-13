import { prisma } from '../src/services/db.service.js';
import { enqueueEmailJob, emailQueue } from '../src/services/queue.service.js';
import { createEmailWorker, stopEmailWorker } from '../src/services/worker.service.js';
import { initEmailTransporter } from '../src/services/email.service.js';
import { redis } from '../src/config/redis.js';

async function runE2ESendVerification(): Promise<void> {
  console.log('--- [VERIFICATION] End-to-End SMTP Send & Ethereal Inbox Link ---');

  await initEmailTransporter();

  // Create test user
  const user = await prisma.user.upsert({
    where: { email: 'e2e-tester@example.com' },
    update: {},
    create: {
      email: 'e2e-tester@example.com',
      name: 'E2E Tester',
    },
  });

  const email = await prisma.email.create({
    data: {
      userId: user.id,
      senderEmail: 'oliver.brown@reachinbox.ai',
      recipientEmail: 'candidate.review@ethereal.email',
      subject: 'ReachInbox Hiring Assignment - E2E Verification Email',
      body: '<p>Hello <b>ReachInbox Review Team</b>!</p><p>This is a live test email sent via Ethereal SMTP with BullMQ delayed job processing.</p>',
      scheduledTime: new Date(Date.now() + 1000), // 1 second in the future
      delayBetweenEmails: 1,
      hourlyLimit: 100,
      status: 'SCHEDULED',
    },
  });

  console.log(`Created email in DB: ${email.id} -> ${email.recipientEmail}`);

  // Enqueue job
  await enqueueEmailJob(
    {
      emailId: email.id,
      userId: user.id,
      senderEmail: email.senderEmail,
      recipientEmail: email.recipientEmail,
      subject: email.subject,
      body: email.body,
      delayBetweenEmails: 1,
      hourlyLimit: 100,
    },
    email.scheduledTime
  );

  console.log('Enqueued job into BullMQ. Starting worker to process job...');
  createEmailWorker();

  // Wait for worker to pick up and process
  let completedEmail = null;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const record = await prisma.email.findUnique({ where: { id: email.id } });
    if (record?.status === 'SENT' || record?.status === 'FAILED') {
      completedEmail = record;
      break;
    }
  }

  await stopEmailWorker();

  if (!completedEmail) {
    throw new Error('E2E Send timed out waiting for worker to finalize email');
  }

  if (completedEmail.status !== 'SENT') {
    throw new Error(`E2E Send failed: Status=${completedEmail.status}, Error=${completedEmail.error}`);
  }

  console.log('✅ Email successfully dispatched via Ethereal SMTP!');
  console.log(`✅ Message ID: ${completedEmail.etherealMessageId}`);
  console.log(`📬 Live Ethereal Preview URL: ${completedEmail.etherealPreviewUrl}`);

  // Cleanup
  await emailQueue.remove(email.id);
  await prisma.email.delete({ where: { id: email.id } });

  console.log('✅ PASS: End-to-End SMTP send & preview generation verified.');
}

export { runE2ESendVerification };

if (import.meta.url === `file://${process.argv[1]}`) {
  runE2ESendVerification()
    .then(async () => {
      await prisma.$disconnect();
      await redis.quit();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await prisma.$disconnect();
      await redis.quit();
      process.exit(1);
    });
}
