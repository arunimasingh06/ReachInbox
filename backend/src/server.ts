import { createApp } from './app.js';
import { config } from './config/env.js';
import { connectDB, disconnectDB } from './services/db.service.js';
import { initElasticsearch } from './services/search.service.js';
import { initEmailTransporter } from './services/email.service.js';
import { reconcileOnBoot } from './services/reconciler.service.js';
import { redis } from './config/redis.js';

async function startServer(): Promise<void> {
  console.log('====================================================');
  console.log('🚀 Starting ReachInbox Email Scheduler API Server');
  console.log(`🌍 Environment: ${config.nodeEnv} | Port: ${config.port}`);
  console.log('====================================================');

  try {
    // 1. Connect PostgreSQL (Single Source of Truth)
    await connectDB();

    // 2. Initialize Ethereal SMTP Transporter
    await initEmailTransporter();

    // 3. Initialize Elasticsearch Search Index
    await initElasticsearch();

    // 4. Run Startup Persistence Reconciliation
    await reconcileOnBoot();

    // 5. Start Express API Server
    const app = createApp();
    const server = app.listen(config.port, () => {
      console.log(`\n✅ API Server is listening on http://localhost:${config.port}`);
      console.log(`📊 Bull Board Queue Dashboard: http://localhost:${config.port}/admin/queues`);
      console.log(`🔍 Health Check: http://localhost:${config.port}/health\n`);
    });

    // Graceful shutdown handling
    const shutdown = async (signal: string) => {
      console.log(`\n[Server] Received ${signal}. Initiating graceful shutdown...`);
      server.close(async () => {
        console.log('[Server] HTTP server closed.');
        try {
          await disconnectDB();
          await redis.quit();
          console.log('[Server] Database and Redis connections cleanly closed.');
          process.exit(0);
        } catch (err: any) {
          console.error('[Server] Error during clean shutdown:', err.message);
          process.exit(1);
        }
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error: any) {
    console.error('❌ Failed to start API server:', error);
    process.exit(1);
  }
}

startServer();
