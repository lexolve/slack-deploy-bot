/**
 * Type-safe configuration with const assertions and type guards
 */

import { asTriggerId, asProjectId, asSlackUserId, type TriggerId, type ProjectId, type SlackUserId } from './types';

// ===== Service Configuration with Const Assertion =====

export const SERVICES = {
  'backend-api': {
    triggerId: asTriggerId('deploy-backend-api'),
    displayName: 'Backend API',
  },
  'frontend': {
    triggerId: asTriggerId('deploy-frontend-app'),
    displayName: 'Frontend App',
  },
  // Add more services here
} as const;

// Derive ServiceAlias type from config keys
export type ServiceAlias = keyof typeof SERVICES;

// Get all valid service aliases
export function getValidServices(): readonly ServiceAlias[] {
  return Object.keys(SERVICES) as ServiceAlias[];
}

// Type guard for service validation
export function isValidService(value: string): value is ServiceAlias {
  return value in SERVICES;
}

// Get service config (type-safe)
export function getServiceConfig(service: ServiceAlias): {
  readonly triggerId: TriggerId;
  readonly displayName: string;
} {
  return SERVICES[service];
}

// ===== Environment Configuration with Const Assertion =====

export const ENVIRONMENTS = {
  staging: {
    projectId: asProjectId(process.env['STAGING_PROJECT_ID'] ?? ''),
    displayName: 'Staging',
  },
  prod: {
    projectId: asProjectId(process.env['PROD_PROJECT_ID'] ?? ''),
    displayName: 'Production',
  },
} as const;

// Derive Environment type from config keys
export type Environment = keyof typeof ENVIRONMENTS;

// Get all valid environments
export function getValidEnvironments(): readonly Environment[] {
  return Object.keys(ENVIRONMENTS) as Environment[];
}

// Type guard for environment validation
export function isValidEnvironment(value: string): value is Environment {
  return value in ENVIRONMENTS;
}

// Get environment config (type-safe)
export function getEnvironmentConfig(env: Environment): {
  readonly projectId: ProjectId;
  readonly displayName: string;
} {
  return ENVIRONMENTS[env];
}

// ===== User Allowlist =====

function parseAllowedUsers(envVar: string | undefined): readonly SlackUserId[] {
  if (!envVar) {
    return [];
  }
  return envVar
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
    .map(asSlackUserId);
}

export const ALLOWED_USERS: readonly SlackUserId[] = parseAllowedUsers(
  process.env['ALLOWED_USERS']
);

// ===== Slack Configuration =====

export const SLACK_SIGNING_SECRET = process.env['SLACK_SIGNING_SECRET'] ?? '';

// ===== Configuration Validation =====

export interface ConfigValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export function validateConfig(): ConfigValidation {
  const errors: string[] = [];

  if (!SLACK_SIGNING_SECRET) {
    errors.push('SLACK_SIGNING_SECRET environment variable is required');
  }

  if (ALLOWED_USERS.length === 0) {
    errors.push(
      'ALLOWED_USERS environment variable is required (comma-separated Slack user IDs)'
    );
  }

  if (!process.env['STAGING_PROJECT_ID']) {
    errors.push('STAGING_PROJECT_ID environment variable is required');
  }

  if (!process.env['PROD_PROJECT_ID']) {
    errors.push('PROD_PROJECT_ID environment variable is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
