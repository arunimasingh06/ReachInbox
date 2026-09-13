import { runRateLimitVerification } from './verify-ratelimit.js';
import { runDelayVerification } from './verify-delay.js';
import { runIdempotencyVerification } from './verify-idempotency.js';
import { runReconciliationVerification } from './verify-reconciliation.js';
import { runE2ESendVerification } from './verify-e2e-send.js';
import { redis } from '../src/config/redis.js';
import { prisma } from '../src/services/db.service.js';

async function main(): Promise<void> {
  console.log('===============================================================');
  console.log('🧪 REACHINBOX EMAIL SCHEDULER: MASTER VERIFICATION SUITE');
  console.log('===============================================================\n');

  try {
    await runRateLimitVerification();
    console.log('\n---------------------------------------------------------------\n');

    await runDelayVerification();
    console.log('\n---------------------------------------------------------------\n');

    await runIdempotencyVerification();
    console.log('\n---------------------------------------------------------------\n');

    await runReconciliationVerification();
    console.log('\n---------------------------------------------------------------\n');

    await runE2ESendVerification();
    console.log('\n---------------------------------------------------------------\n');

    console.log('===============================================================');
    console.log('🎉 ALL ARCHITECTURAL & END-TO-END VERIFICATIONS PASSED (5/5)!');
    console.log('===============================================================');
  } catch (error: any) {
    console.error('\n❌ VERIFICATION SUITE FAILED:', error);
    process.exit(1);
  } finally {
    try {
      await prisma.$disconnect();
      await redis.quit();
    } catch {
      // Ignore cleanup error
    }
    process.exit(0);
  }
}

main();
