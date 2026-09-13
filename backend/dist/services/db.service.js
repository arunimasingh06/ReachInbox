import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
export async function connectDB() {
    try {
        await prisma.$connect();
        console.log('[PostgreSQL] Database connection established successfully via Prisma.');
    }
    catch (err) {
        console.error('[PostgreSQL] Database connection failed:', err.message);
        throw err;
    }
}
export async function disconnectDB() {
    await prisma.$disconnect();
}
