import { verifyJWT } from './jwt';
import { errorResponse, type JWTPayload } from './types';
import type { IDatabase } from '../ports';

export async function requireAuth(
  request: Request,
  db: IDatabase,
  jwtSecret: string,
  requiredRoles?: string[]
): Promise<{ user: JWTPayload } | Response> {
  const authHeader = request.headers.get('Authorization');
  const cookieHeader = request.headers.get('Cookie');

  let token: string | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (cookieHeader) {
    const match = cookieHeader.match(/bmi_token=([^;]+)/);
    if (match) token = match[1];
  }

  if (!token) {
    return errorResponse('Authentication required', 401);
  }

  const payload = await verifyJWT(token, jwtSecret);
  if (!payload) {
    return errorResponse('Invalid or expired token', 401);
  }

  const user = payload as unknown as JWTPayload;

  // Authorize against the LIVE database role, not the JWT-embedded role.
  // Roles flip server-side (e.g. applicant → student on offer acceptance) while
  // outstanding tokens still carry the old claim; gating on the token would
  // 403 users mid-journey until they log out and back in. Fall back to the
  // token claim only when the role column cannot be read (legacy/mocked DBs).
  const dbUser = await db.prepare(
    `SELECT session_version, role FROM users WHERE id = ?`
  ).bind(user.sub).first<{ session_version: number; role?: string }>().catch(async () => {
    return await db.prepare(
      `SELECT session_version FROM users WHERE id = ?`
    ).bind(user.sub).first<{ session_version: number; role?: string }>();
  });

  if (!dbUser) {
    return errorResponse('User not found', 401);
  }

  if (dbUser.session_version !== user.sv) {
    return errorResponse('Session has been invalidated. Please log in again.', 401);
  }

  const effectiveRole = dbUser.role || user.role;
  if (requiredRoles && !requiredRoles.includes(effectiveRole) && effectiveRole !== 'admin' && effectiveRole !== 'superadmin') {
    return errorResponse('Insufficient permissions', 403);
  }

  return { user };
}
