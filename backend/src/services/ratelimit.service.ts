import { redis } from '../config/redis.js';

/**
 * Atomic Redis Lua Script for Per-Sender Hourly Rate Limiting:
 *
 * KEYS[1]: ratelimit:{senderEmail}:{YYYYMMDDHH}
 * ARGV[1]: hourlyLimit (number)
 * ARGV[2]: ttlSeconds (number, e.g. 7200)
 *
 * Atomically checks whether the sender has reached their hourly limit.
 * If limit reached, returns { 0, current_count } without incrementing.
 * If slot available, increments count, sets TTL if first send, and returns { 1, new_count }.
 * Completely eliminates race conditions across concurrent workers.
 */
const ATOMIC_RATE_LIMIT_LUA = `
local current = redis.call('GET', KEYS[1])
if current and tonumber(current) >= tonumber(ARGV[1]) then
  return { 0, tonumber(current) }
end

local next_val = redis.call('INCR', KEYS[1])
if next_val == 1 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
end

return { 1, next_val }
`;

export function getHourWindowKey(senderEmail: string, date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  const windowId = `${y}${m}${d}${h}`;
  return `ratelimit:${senderEmail}:${windowId}`;
}

export function getStartOfNextHourWindow(date: Date = new Date()): Date {
  const nextHour = new Date(date);
  nextHour.setUTCMinutes(0, 0, 0);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1);
  return nextHour;
}

/**
 * Atomically check and reserve an email slot for the current hour window.
 */
export async function checkAndIncrementHourlyLimit(
  senderEmail: string,
  hourlyLimit: number
): Promise<{ allowed: boolean; currentCount: number }> {
  const hourKey = getHourWindowKey(senderEmail);
  const ttlSeconds = 7200; // 2 hours retention

  // Execute atomic Lua script
  const result = (await redis.eval(
    ATOMIC_RATE_LIMIT_LUA,
    1,
    hourKey,
    hourlyLimit.toString(),
    ttlSeconds.toString()
  )) as [number, number];

  const allowed = result[0] === 1;
  const currentCount = result[1];

  return { allowed, currentCount };
}

/**
 * Per-Sender Minimum Send Delay Throttle:
 * Checks whether the minimum delay between emails has elapsed for this specific sender.
 * Prevents Sender A from blocking Sender B.
 */
export async function checkSenderMinDelay(
  senderEmail: string,
  minDelaySeconds: number
): Promise<{ allowed: boolean; waitTimeMs: number }> {
  const key = `sender:last_sent:${senderEmail}`;
  const lastSentStr = await redis.get(key);
  const minDelayMs = minDelaySeconds * 1000;
  const now = Date.now();

  if (lastSentStr) {
    const lastSent = parseInt(lastSentStr, 10);
    const elapsed = now - lastSent;
    if (elapsed < minDelayMs) {
      const waitTimeMs = minDelayMs - elapsed;
      return { allowed: false, waitTimeMs };
    }
  }

  return { allowed: true, waitTimeMs: 0 };
}

/**
 * Record the timestamp when an email was actually sent for this sender.
 */
export async function recordSenderSentTimestamp(senderEmail: string): Promise<void> {
  const key = `sender:last_sent:${senderEmail}`;
  const now = Date.now();
  // Store timestamp with 24-hour expiration
  await redis.set(key, now.toString(), 'EX', 86400);
}
