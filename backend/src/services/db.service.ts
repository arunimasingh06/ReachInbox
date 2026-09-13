import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export async function connectDB(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('[PostgreSQL] Database connection established successfully via Prisma.');
  } catch (err: any) {
    console.error('[PostgreSQL] Database connection failed:', err.message);
    throw err;
  }
}

export async function disconnectDB(): Promise<void> {
  await prisma.$disconnect();
}
