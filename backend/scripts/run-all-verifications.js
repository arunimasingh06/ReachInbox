"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const verify_ratelimit_js_1 = require("./verify-ratelimit.js");
const verify_delay_js_1 = require("./verify-delay.js");
const verify_idempotency_js_1 = require("./verify-idempotency.js");
const verify_reconciliation_js_1 = require("./verify-reconciliation.js");
const redis_js_1 = require("../src/config/redis.js");
const db_service_js_1 = require("../src/services/db.service.js");
async function main() {
    console.log('===============================================================');
    console.log('🧪 REACHINBOX EMAIL SCHEDULER: SYSTEM VERIFICATION SUITE');
    console.log('===============================================================\n');
    try {
        await (0, verify_ratelimit_js_1.runRateLimitVerification)();
        console.log('\n---------------------------------------------------------------\n');
        await (0, verify_delay_js_1.runDelayVerification)();
        console.log('\n---------------------------------------------------------------\n');
        await (0, verify_idempotency_js_1.runIdempotencyVerification)();
        console.log('\n---------------------------------------------------------------\n');
        await (0, verify_reconciliation_js_1.runReconciliationVerification)();
        console.log('\n---------------------------------------------------------------\n');
        console.log('===============================================================');
        console.log('🎉 ALL ARCHITECTURAL VERIFICATIONS PASSED SUCCESSFULLY (4/4)!');
        console.log('===============================================================');
    }
    catch (error) {
        console.error('\n❌ VERIFICATION SUITE FAILED:', error);
        process.exit(1);
    }
    finally {
        try {
            await db_service_js_1.prisma.$disconnect();
            await redis_js_1.redis.quit();
        }
        catch {
            // Ignore cleanup error
        }
    }
}
main();
