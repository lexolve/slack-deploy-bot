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
  'lexolve-client': {
    triggerId: asTriggerId('deploy-lexolve-client'),
    displayName: 'Lexolve Client',
  },
  'website': {
    triggerId: asTriggerId('deploy-lexolve-website'),
    displayName: 'Lexolve Website',
  },
  'advokatt': {
    triggerId: asTriggerId('deploy-advokatt'),
    displayName: 'Advokatt',
  },
  'langgraph-agent': {
    triggerId: asTriggerId('deploy-langgraph-agent'),
    displayName: 'LangGraph Agent',
  },
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

// Generate help message with available services
export function getHelpMessage(): string {
  const serviceList = Object.entries(SERVICES)
    .map(([alias, config]) => `  • \`${alias}\` - ${config.displayName}`)
    .join('\n');

  const envList = Object.entries(ENVIRONMENTS)
    .map(([alias, config]) => `  • \`${alias}\` - ${config.displayName}`)
    .join('\n');

  return (
    `:rocket: *Deploy Bot Help*\n\n` +
    `*Usage:* \`/deploy <service> <environment>\`\n\n` +
    `*Available services:*\n${serviceList}\n\n` +
    `*Available environments:*\n${envList}\n\n` +
    `*Examples:*\n` +
    `  • \`/deploy backend-api staging\`\n` +
    `  • \`/deploy lexolve-client prod\`\n\n` +
    `*Other commands:*\n` +
    `  • \`/deploy help\` - Show this help message\n` +
    `  • \`/deploy list\` - List available services`
  );
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
