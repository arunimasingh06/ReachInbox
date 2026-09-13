import { config } from './config/env.js';
import { connectDB, disconnectDB } from './services/db.service.js';
import { initElasticsearch } from './services/search.service.js';
import { initEmailTransporter } from './services/email.service.js';
import { createEmailWorker, stopEmailWorker } from './services/worker.service.js';
import { redis } from './config/redis.js';
async function startWorker() {
    console.log('====================================================');
    console.log('⚙️ Starting ReachInbox Distributed Email Worker Process');
    console.log(`⚡ Concurrency: ${config.worker.concurrency} | Min Delay: ${config.worker.minSendDelaySeconds}s`);
    console.log(`🛡️ Max Hourly Cap: ${config.worker.maxEmailsPerHourPerSender}/sender`);
    console.log('====================================================');
    try {
        // 1. Connect PostgreSQL
        await connectDB();
        // 2. Initialize SMTP Transporter
        await initEmailTransporter();
        // 3. Initialize Elasticsearch Client
        await initElasticsearch();
        // 4. Start BullMQ Worker
        createEmailWorker();
        console.log('\n✅ BullMQ Worker is active and listening for email jobs.\n');
        // Graceful shutdown handling
        const shutdown = async (signal) => {
            console.log(`\n[Worker Process] Received ${signal}. Initiating graceful shutdown...`);
            try {
                await stopEmailWorker();
                await disconnectDB();
                await redis.quit();
                console.log('[Worker Process] Connections cleanly closed. Exiting.');
                process.exit(0);
            }
            catch (err) {
                console.error('[Worker Process] Error during clean shutdown:', err.message);
                process.exit(1);
            }
        };
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
    }
    catch (error) {
        console.error('❌ Failed to start worker process:', error);
        process.exit(1);
    }
}
startWorker();
