import dotenv from 'dotenv';
import path from 'path';
// Load .env from backend directory
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
export const config = {
    port: parseInt(process.env.PORT || '5001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/reachinbox_scheduler?schema=public',
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
    },
    worker: {
        concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
        minSendDelaySeconds: parseInt(process.env.MIN_SEND_DELAY_SECONDS || '2', 10),
        maxEmailsPerHourPerSender: parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '100', 10),
    },
    elasticsearch: {
        node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
        index: process.env.ELASTICSEARCH_INDEX || 'emails',
    },
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    },
    jwtSecret: process.env.JWT_SECRET || 'reachinbox-jwt-secret-key-2026',
    slack: {
        clientId: process.env.SLACK_CLIENT_ID || '',
        clientSecret: process.env.SLACK_CLIENT_SECRET || '',
        redirectUri: process.env.SLACK_REDIRECT_URI || 'http://localhost:5000/api/slack/oauth/callback',
    },
    ethereal: {
        user: process.env.ETHEREAL_USER || '',
        pass: process.env.ETHEREAL_PASS || '',
        host: process.env.ETHEREAL_HOST || 'smtp.ethereal.email',
        port: parseInt(process.env.ETHEREAL_PORT || '587', 10),
    },
};
