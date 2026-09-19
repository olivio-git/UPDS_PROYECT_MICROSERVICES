import { Request } from 'express';
import { AuditLog, AuditLogRepository } from '../repositories/audit-log.repository';
import { JWTPayload } from '../types/index';

const repo = new AuditLogRepository();

/**
 * Fire-and-forget audit logger. Registers an action without blocking the request.
 */
export function auditLog(
  action: string,
  target: AuditLog['target'],
  options: {
    actor?: AuditLog['actor'];
    req?: Request;
    details?: Record<string, any>;
    status?: 'success' | 'failure';
    service?: string;
  } = {}
): void {
  const actor: AuditLog['actor'] = { ...(options.actor ?? {}) };

  if (options.req) {
    const jwtUser = (options.req as any).user as JWTPayload | undefined;
    if (jwtUser) {
      actor.userId = actor.userId ?? jwtUser.userId;
      actor.email = actor.email ?? (jwtUser as any).email;
      actor.role = actor.role ?? jwtUser.role;
    }
    const forwarded = options.req.headers['x-forwarded-for'];
    actor.ip =
      actor.ip ??
      (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined) ??
      options.req.socket?.remoteAddress;
  }

  const entry: Omit<AuditLog, '_id'> = {
    timestamp: new Date(),
    service: options.service ?? 'user-management',
    action,
    actor,
    target,
    details: options.details,
    status: options.status ?? 'success',
  };

  repo.create(entry).catch((err) => console.warn('[AuditLog] Error saving audit log:', err));
}
