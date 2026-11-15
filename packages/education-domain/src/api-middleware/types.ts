export interface JWTPayload {
  sub: string;
  email: string;
  role: string;
  sv: number;
}

export function errorResponse(message: string, status = 400): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
