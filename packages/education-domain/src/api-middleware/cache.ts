export async function readThrough(
  request: Request,
  ttlSeconds: number,
  handler: () => Promise<Response>
): Promise<Response> {
  // Only cache GET requests — never cache POST/PUT/DELETE
  if (request.method !== 'GET') return handler();

  // Bypass cache for filtered queries (high cardinality) to avoid stale data
  const url = new URL(request.url);
  // Remove standard pagination params from size check
  const params = new URLSearchParams(url.search);
  params.delete('page');
  params.delete('perPage');
  
  if (params.size > 0) return handler();

  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) {
    // Clone and add HIT header for observability
    const headers = new Headers(cached.headers);
    headers.set('X-Cache', 'HIT');
    return new Response(cached.body, { status: cached.status, headers });
  }

  const response = await handler();

  // Only cache 200 responses — never cache errors
  if (response.status === 200) {
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', `private, max-age=${ttlSeconds}`);
    headers.set('X-Cache', 'MISS');
    const cacheable = new Response(response.clone().body, { status: 200, headers });
    await cache.put(request, cacheable);
  }

  return response;
}

export async function invalidateCache(requestUrl: string): Promise<void> {
  const cache = caches.default;
  // Try to delete exact base URL match if query params aren't used for invalidation
  await cache.delete(new Request(requestUrl));
}
