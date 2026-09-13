import {
  checkSenderMinDelay,
  recordSenderSentTimestamp,
} from '../src/services/ratelimit.service.js';
import { redis } from '../src/config/redis.js';

async function runDelayVerification(): Promise<void> {
  console.log('--- [VERIFICATION] Per-Sender Minimum Send Delay ---');

  const senderA = `sender-a-${Date.now()}@domain.io`;
  const senderB = `sender-b-${Date.now()}@domain.io`;
  const minDelaySec = 2;

  // Clean Redis keys
  await redis.del(`sender:last_sent:${senderA}`);
  await redis.del(`sender:last_sent:${senderB}`);

  // 1. First send for Sender A should be allowed
  const check1A = await checkSenderMinDelay(senderA, minDelaySec);
  if (!check1A.allowed) {
    throw new Error('Initial send for Sender A should be allowed');
  }
  console.log('✅ 1. First send for Sender A is allowed.');

  // Record that Sender A sent
  await recordSenderSentTimestamp(senderA);

  // 2. Immediate second send for Sender A should be throttled
  const check2A = await checkSenderMinDelay(senderA, minDelaySec);
  if (check2A.allowed) {
    throw new Error('Immediate subsequent send for Sender A should be throttled');
  }
  console.log(`✅ 2. Immediate send for Sender A correctly throttled (Wait: ${check2A.waitTimeMs}ms).`);

  // 3. Sender B should NOT be blocked by Sender A's throttle
  const check1B = await checkSenderMinDelay(senderB, minDelaySec);
  if (!check1B.allowed) {
    throw new Error('Sender B should NOT be blocked by Sender A');
  }
  console.log('✅ 3. Sender B is allowed independently while Sender A is throttled.');

  // 4. Wait for Sender A's delay window to expire
  console.log('Waiting 2.1 seconds for Sender A throttle window to pass...');
  await new Promise((r) => setTimeout(r, 2100));

  const check3A = await checkSenderMinDelay(senderA, minDelaySec);
  if (!check3A.allowed) {
    throw new Error('Sender A should be allowed after delay duration has elapsed');
  }
  console.log('✅ 4. Sender A is allowed again after delay duration passed.');
  console.log('✅ PASS: Per-Sender Minimum Delay works independently per sender.');
}

export { runDelayVerification };

if (import.meta.url === `file://${process.argv[1]}`) {
  runDelayVerification()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
