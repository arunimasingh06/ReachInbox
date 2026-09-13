import { checkAndIncrementHourlyLimit, getStartOfNextHourWindow, getHourWindowKey } from '../src/services/ratelimit.service.js';
import { redis } from '../src/config/redis.js';

async function runRateLimitVerification(): Promise<void> {
  console.log('--- [VERIFICATION] Atomic Redis Lua Hourly Rate Limiter ---');

  const testSender = `test-sender-${Date.now()}@domain.io`;
  const hourlyCap = 5;
  const totalConcurrentAttempts = 12;

  console.log(`Configuring test sender: ${testSender}`);
  console.log(`Setting hourly cap: ${hourlyCap} emails/hour`);
  console.log(`Simulating ${totalConcurrentAttempts} concurrent worker attempts via Promise.all...`);

  // Ensure clean slate in Redis for this test sender
  const windowKey = getHourWindowKey(testSender);
  await redis.del(windowKey);

  // Fire concurrent attempts simultaneously
  const results = await Promise.all(
    Array.from({ length: totalConcurrentAttempts }).map(() =>
      checkAndIncrementHourlyLimit(testSender, hourlyCap)
    )
  );

  const allowedCount = results.filter((r) => r.allowed).length;
  const deniedCount = results.filter((r) => !r.allowed).length;

  console.log(`Results: Allowed=${allowedCount}, Denied (Rescheduled)=${deniedCount}`);

  if (allowedCount !== hourlyCap) {
    throw new Error(
      `Rate limit verification FAILED: Expected exactly ${hourlyCap} allowed, got ${allowedCount}`
    );
  }

  if (deniedCount !== totalConcurrentAttempts - hourlyCap) {
    throw new Error(
      `Rate limit verification FAILED: Expected exactly ${totalConcurrentAttempts - hourlyCap} denied, got ${deniedCount}`
    );
  }

  // Verify next hour calculation
  const nextHour = getStartOfNextHourWindow();
  const now = new Date();
  if (nextHour.getTime() <= now.getTime()) {
    throw new Error('Next hour window calculation returned past/current time');
  }

  console.log(`✅ Next hour window properly calculated: ${nextHour.toISOString()}`);
  console.log('✅ PASS: Atomic Redis Lua Rate Limiter prevented all race conditions perfectly.');
}

export { runRateLimitVerification };

if (import.meta.url === `file://${process.argv[1]}`) {
  runRateLimitVerification()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
