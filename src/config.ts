/**
 * Type-safe configuration with const assertions and type guards
 */

import { asTriggerId, asProjectId, asSlackUserId, type TriggerId, type ProjectId, type SlackUserId } from './types';

// ===== Service Configuration from Environment =====

interface ServiceConfig {
  triggerId: TriggerId;
  displayName: string;
}

type ServicesMap = Record<string, ServiceConfig>;

/**
 * Parse SERVICES_CONFIG env var
 * Format: "alias1:triggerId1:Display Name 1,alias2:triggerId2:Display Name 2"
 */
function parseServicesConfig(): ServicesMap {
  const configStr = process.env['SERVICES_CONFIG'] ?? '';
  if (!configStr) {
    return {};
  }

  const services: ServicesMap = {};
  for (const entry of configStr.split(',')) {
    const [alias, triggerId, displayName] = entry.split(':');
    if (alias && triggerId && displayName) {
      services[alias.trim()] = {
        triggerId: asTriggerId(triggerId.trim()),
        displayName: displayName.trim(),
      };
    }
  }
  return services;
}

export const SERVICES: ServicesMap = parseServicesConfig();

// Service alias is now dynamic from env var
export type ServiceAlias = string;

// Get all valid service aliases
export function getValidServices(): string[] {
  return Object.keys(SERVICES);
}

// Type guard for service validation
export function isValidService(value: string): value is ServiceAlias {
  return value in SERVICES;
}

// Get service config
export function getServiceConfig(service: ServiceAlias): ServiceConfig | undefined {
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
    `  • \`/deploy list\` - List available services\n` +
    `  • \`/deploy status staging\` - Show recent staging builds\n` +
    `  • \`/deploy status prod\` - Show recent prod builds`
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
