/**
 * Type-safe interfaces with branded types and discriminated unions
 */

// ===== Branded Types for Compile-Time Safety =====

type Brand<T, B> = T & { readonly __brand: B };

export type SlackUserId = Brand<string, 'SlackUserId'>;
export type TriggerId = Brand<string, 'TriggerId'>;
export type ProjectId = Brand<string, 'ProjectId'>;

// Helper to create branded types (use with caution - validates at runtime)
export const asSlackUserId = (id: string): SlackUserId => id as SlackUserId;
export const asTriggerId = (id: string): TriggerId => id as TriggerId;
export const asProjectId = (id: string): ProjectId => id as ProjectId;

// ===== Slack Types =====

export interface SlackSlashCommand {
  readonly token: string;
  readonly team_id: string;
  readonly team_domain: string;
  readonly channel_id: string;
  readonly channel_name: string;
  readonly user_id: string;
  readonly user_name: string;
  readonly command: string;
  readonly text: string;
  readonly response_url: string;
  readonly trigger_id: string;
}

// Slack response types
export interface SlackEphemeralResponse {
  readonly response_type: 'ephemeral';
  readonly text: string;
}

export interface SlackChannelResponse {
  readonly response_type: 'in_channel';
  readonly text: string;
}

export type SlackResponse = SlackEphemeralResponse | SlackChannelResponse;

// ===== Signature Verification =====

export interface VerificationSuccess {
  readonly valid: true;
}

export interface VerificationFailure {
  readonly valid: false;
  readonly reason: string;
}

export type VerificationResult = VerificationSuccess | VerificationFailure;

// ===== Audit Log Types (Discriminated Union) =====

interface AuditLogBase {
  readonly timestamp: string;
  readonly userId: SlackUserId;
  readonly userName: string;
  readonly service: string; // Will be ServiceAlias after config
  readonly environment: string; // Will be Environment after config
  readonly durationMs: number;
}

export type AuditLog =
  | (AuditLogBase & {
      readonly status: 'SUCCESS';
      readonly projectId: ProjectId;
      readonly triggerId: TriggerId;
      readonly buildId: string;
    })
  | (AuditLogBase & {
      readonly status: 'DENIED';
      readonly reason: string;
    })
  | (AuditLogBase & {
      readonly status: 'ERROR';
      readonly errorMessage: string;
      readonly projectId?: ProjectId;
      readonly triggerId?: TriggerId;
    });

// ===== Cloud Build Types =====

export interface BuildResult {
  readonly buildId: string;
  readonly logUrl: string;
  readonly projectId: ProjectId;
}

// Cloud Build error codes
export type CloudBuildErrorCode =
  | 'INVALID_RESPONSE'
  | 'TRIGGER_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'UNKNOWN_ERROR';

export interface CloudBuildError {
  readonly code: CloudBuildErrorCode;
  readonly message: string;
  readonly originalError?: unknown;
}

// ===== Parse Errors =====

export type ParseErrorCode =
  | 'MISSING_SERVICE'
  | 'MISSING_ENV'
  | 'INVALID_SERVICE'
  | 'INVALID_ENV';

export interface ParseError {
  readonly code: ParseErrorCode;
  readonly message: string;
}
