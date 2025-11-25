/**
 * User authorization utilities with branded types
 */

import { type SlackUserId } from './types';
import { ALLOWED_USERS } from './config';

/**
 * Check if a Slack user is authorized to trigger deployments
 */
export function isUserAuthorized(userId: SlackUserId): boolean {
  return ALLOWED_USERS.includes(userId);
}

/**
 * Get authorization error message with helpful information
 */
export function getAuthorizationErrorMessage(userId: SlackUserId): string {
  return `:x: You are not authorized to trigger deployments.\n\nYour user ID: \`${userId}\`\n\nPlease contact an administrator to be added to the allowlist.`;
}
