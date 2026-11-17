/**
 * Request Tracing Middleware — Phase 1 Observability
 *
 * Injects an `X-Request-ID` header into every inbound request and propagates
 * it through all outbound inter-Worker fetch calls. This allows correlating
 * log lines across bmi-auth, bmi-core, bmi-ums, etc. in Cloudflare Logpush.
 *
 * Usage (in any Worker's fetch handler, before routing):
 *   const { reqId, tracedRequest } = withRequestId(request);
 *   const log = createLogger('bmi-auth').child({ reqId });
 *
 * When calling another Worker:
 *   await fetch(url, injectTraceHeaders(outboundInit, reqId));
 */

const TRACE_HEADER = 'X-Request-ID';

/**
 * Extracts or generates an `X-Request-ID` for a request.
 * If the upstream caller already provided one, it is reused (so the chain
 * is traceable end-to-end). Otherwise a new UUID is generated.
 *
 * Returns:
 *   - `reqId`        — the trace ID to embed in all log entries
 *   - `tracedRequest`— a copy of the request with X-Request-ID set
 */
export function withRequestId(request: Request): { reqId: string; tracedRequest: Request } {
  const existing = request.headers.get(TRACE_HEADER);
  const reqId = existing ?? crypto.randomUUID();

  // Clone headers and ensure the trace header is present
  const headers = new Headers(request.headers);
  headers.set(TRACE_HEADER, reqId);

  // Return a new request with the updated headers
  const tracedRequest = new Request(request, { headers });
  return { reqId, tracedRequest };
}

/**
 * Injects the `X-Request-ID` trace header into an outbound fetch `RequestInit`.
 * Use this when calling other Workers or external services to propagate the trace.
 *
 * @example
 *   const res = await fetch(targetUrl, injectTraceHeaders({ method: 'POST', body: '...' }, reqId));
 */
export function injectTraceHeaders(init: RequestInit, reqId: string): RequestInit {
  const headers = new Headers((init.headers as HeadersInit | undefined) ?? {});
  headers.set(TRACE_HEADER, reqId);
  return { ...init, headers };
}

/**
 * Adds `X-Request-ID` to an outbound Response so browsers and downstream
 * services can correlate the response to the originating request.
 */
export function addTraceToResponse(response: Response, reqId: string): Response {
  const headers = new Headers(response.headers);
  headers.set(TRACE_HEADER, reqId);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
