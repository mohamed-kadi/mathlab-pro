import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { MathLabRepository } from './repository.js';

interface AuditedRequest extends Request {
  authUser?: { id: string };
}

const redactedKeys = new Set([
  'authorization',
  'cookie',
  'password',
  'passwordhash',
  'token',
  'jwt',
  'jwtsecret',
  'secret',
  'apikey',
  'gemini_api_key'
]);

export function auditMiddleware(repository: MathLabRepository) {
  return (req: AuditedRequest, res: Response, next: NextFunction) => {
    const startedAt = Date.now();
    const originalJson = res.json;

    res.json = function jsonWithAudit(body?: unknown) {
      res.locals.auditResponseBody = body;
      return originalJson.call(this, body);
    };

    res.on('finish', () => {
      const auditEvent = buildAuditEvent(req, res, Date.now() - startedAt);
      if (!auditEvent) return;
      void repository.createAuditLog(auditEvent).catch(error => {
        console.warn('Failed to write audit log entry.', error);
      });
    });

    next();
  };
}

function buildAuditEvent(req: AuditedRequest, res: Response, durationMs: number) {
  if (res.statusCode >= 400) return null;

  const pathname = req.originalUrl.split('?')[0];
  if (pathname === '/api/health' || pathname === '/api/audit-logs' || pathname === '/api/cache/status') {
    return null;
  }

  const classification = classifyRequest(pathname, req.method);
  if (!classification) return null;

  const responseBody = res.locals.auditResponseBody as Record<string, unknown> | undefined;
  const metadata = sanitize({
    method: req.method,
    path: pathname,
    statusCode: res.statusCode,
    durationMs,
    cache: res.getHeader('X-MathLab-Cache') || undefined,
    requestBody: req.body,
    query: req.query
  }) as Record<string, unknown>;

  return {
    id: 'audit-' + crypto.randomUUID(),
    userId: req.authUser?.id || res.locals.auditUserId,
    action: classification.action,
    resource: classification.resource,
    resourceId: classification.resourceId || responseBody?.id as string | undefined,
    metadata,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    createdAt: new Date().toISOString()
  };
}

function classifyRequest(pathname: string, method: string) {
  if (pathname.startsWith('/api/math/')) {
    return {
      action: 'calculate',
      resource: `math.${pathname.split('/').at(-1) || 'unknown'}`
    };
  }

  if (pathname === '/api/auth/login') {
    return { action: 'login', resource: 'auth' };
  }
  if (pathname === '/api/auth/register') {
    return { action: 'register', resource: 'auth' };
  }

  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return null;
  }

  const segments = pathname.split('/').filter(Boolean);
  const resource = segments[1] || 'api';
  const resourceId = segments.length > 2 ? segments[2] : undefined;
  const action = method === 'POST'
    ? 'create'
    : method === 'DELETE'
      ? 'delete'
      : 'update';

  return { action, resource, resourceId };
}

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[Truncated]';
  if (typeof value === 'string') return value.length > 500 ? `${value.slice(0, 500)}...` : value;
  if (typeof value === 'number' || typeof value === 'boolean' || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.slice(0, 50).map(item => sanitize(item, depth + 1));
  if (typeof value !== 'object') return String(value);

  return Object.entries(value as Record<string, unknown>)
    .slice(0, 80)
    .reduce<Record<string, unknown>>((result, [key, item]) => {
      result[key] = redactedKeys.has(key.toLowerCase()) ? '[REDACTED]' : sanitize(item, depth + 1);
      return result;
    }, {});
}
