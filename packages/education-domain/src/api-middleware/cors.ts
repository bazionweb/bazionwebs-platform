import { ALLOWED_ORIGINS } from '@bazion/education-contracts';

export function getCorsHeaders(
  request: Request,
  allowedOriginsOverride?: string
): Record<string, string> {
  const origin = request.headers.get('Origin');
  let origins = [...ALLOWED_ORIGINS];

  if (allowedOriginsOverride) {
    const overrideList = allowedOriginsOverride.split(',').map((o) => o.trim());
    origins = Array.from(new Set([...origins, ...overrideList]));
  }

  let isAllowed = origin ? origins.includes(origin) : false;

  if (origin && !isAllowed) {
    // Dynamically match any official Cloudflare Pages branch / preview deployment domain or bmiuniversities.org subdomain
    if (/^https:\/\/(?:[a-zA-Z0-9-]+\.)*pages\.dev$/.test(origin)) {
      isAllowed = true;
    } else if (/^https:\/\/(?:[a-zA-Z0-9-]+\.)*bmiuniversities\.org$/.test(origin)) {
      isAllowed = true;
    } else if (/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin)) {
      isAllowed = true;
    }
  }

  return {
    'Access-Control-Allow-Origin': isAllowed && origin ? origin : origins[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-BMI-Signature, X-BMI-Event, X-CSRF-Token, X-Admin-Setup-Key',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

export function withCors(response: Response, request: Request, allowedOriginsOverride?: string): Response {
  const corsHeaders = getCorsHeaders(request, allowedOriginsOverride);
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    newHeaders.set(key, value);
  }
  newHeaders.set('X-Frame-Options', 'DENY');
  newHeaders.set('X-Content-Type-Options', 'nosniff');
  newHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  newHeaders.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  newHeaders.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  // Only set default CSP if handler did not supply a more specific one
  const hasBody = !([101, 204, 205, 301, 302, 303, 304, 307, 308].includes(response.status) || response.body === null);
  return new Response(hasBody ? response.body : null, { status: response.status, headers: newHeaders });
}
