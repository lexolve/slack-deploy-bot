/**
 * Audit logging for deployment events with discriminated unions
 */

import { Logging } from '@google-cloud/logging';
import { type AuditLog, type SlackUserId, type TriggerId, type ProjectId } from './types';

// Initialize Cloud Logging client
const logging = new Logging();
const log = logging.log('slack-deploy-bot-audit');

/**
 * Write a structured audit log entry to Cloud Logging
 */
export async function logAuditEvent(event: AuditLog): Promise<void> {
  const severity = event.status === 'SUCCESS' ? 'INFO' : 'WARNING';

  const metadata = {
    severity,
    labels: {
      service: event.service,
      environment: event.environment,
      status: event.status,
      user_id: event.userId,
    },
    resource: {
      type: 'cloud_function',
      labels: {
        function_name: 'slack-deploy-bot',
        region: process.env['FUNCTION_REGION'] ?? 'us-central1',
      },
    },
  };

  const entry = log.entry(metadata, event);

  try {
    await log.write(entry);
  } catch (error) {
    // Log to console as fallback if Cloud Logging fails
    console.error('Failed to write audit log:', error);
    console.error('Audit event:', JSON.stringify(event, null, 2));
  }
}

/**
 * Create a successful deployment audit log entry
 */
export function createSuccessAuditLog(
  userId: SlackUserId,
  userName: string,
  service: string,
  environment: string,
  projectId: ProjectId,
  triggerId: TriggerId,
  buildId: string,
  durationMs: number
): AuditLog {
  return {
    timestamp: new Date().toISOString(),
    userId,
    userName,
    service,
    environment,
    projectId,
    triggerId,
    status: 'SUCCESS',
    buildId,
    durationMs,
  };
}

/**
 * Create a denied deployment audit log entry
 */
export function createDeniedAuditLog(
  userId: SlackUserId,
  userName: string,
  service: string,
  environment: string,
  reason: string,
  durationMs: number
): AuditLog {
  return {
    timestamp: new Date().toISOString(),
    userId,
    userName,
    service,
    environment,
    status: 'DENIED',
    reason,
    durationMs,
  };
}

/**
 * Create an error deployment audit log entry
 */
export function createErrorAuditLog(
  userId: SlackUserId,
  userName: string,
  service: string,
  environment: string,
  errorMessage: string,
  durationMs: number,
  projectId?: ProjectId,
  triggerId?: TriggerId
): AuditLog {
  const base = {
    timestamp: new Date().toISOString(),
    userId,
    userName,
    service,
    environment,
    status: 'ERROR' as const,
    errorMessage,
    durationMs,
  };

  // Only include optional fields if they're defined (exactOptionalPropertyTypes)
  if (projectId !== undefined && triggerId !== undefined) {
    return { ...base, projectId, triggerId };
  }
  if (projectId !== undefined) {
    return { ...base, projectId };
  }
  if (triggerId !== undefined) {
    return { ...base, triggerId };
  }
  return base;
}
