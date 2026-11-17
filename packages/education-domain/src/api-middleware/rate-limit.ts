import { errorResponse } from './types';
import type { IRateLimiter } from '../ports';

const RATE_LIMIT_WINDOW = 60;
const RATE_LIMIT_MAX_REQUESTS = 30;

export async function rateLimit(
  request: Request,
  rateLimiter: IRateLimiter,
  maxRequests = RATE_LIMIT_MAX_REQUESTS
): Promise<Response | null> {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const url = new URL(request.url);
  const endpoint = url.pathname;
  
  const key = `${ip}:${endpoint}`;
  
  const { allowed } = await rateLimiter.checkAndIncrement(key, maxRequests, RATE_LIMIT_WINDOW);

  if (!allowed) {
    return errorResponse('Rate limit exceeded. Please try again later.', 429);
  }

  return null;
}
