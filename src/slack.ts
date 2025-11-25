/**
 * Slack request verification and parsing utilities
 */

import * as crypto from 'crypto';
import {
  type SlackSlashCommand,
  type VerificationResult,
  type SlackResponse,
  type ParseError,
} from './types';
import { type Result, ok, err } from './result';
import { type ServiceAlias, type Environment, isValidService, isValidEnvironment } from './config';

const TIMESTAMP_MAX_AGE_SECONDS = 300; // 5 minutes

/**
 * Verify Slack request signature using HMAC-SHA256
 * Implements timing-safe comparison to prevent timing attacks
 */
export function verifySlackRequest(
  signingSecret: string,
  signature: string,
  timestamp: string,
  rawBody: string
): VerificationResult {
  // Step 1: Validate timestamp to prevent replay attacks
  const requestTimestamp = parseInt(timestamp, 10);
  const currentTimestamp = Math.floor(Date.now() / 1000);

  if (Number.isNaN(requestTimestamp)) {
    return { valid: false, reason: 'Invalid timestamp format' };
  }

  if (Math.abs(currentTimestamp - requestTimestamp) > TIMESTAMP_MAX_AGE_SECONDS) {
    return {
      valid: false,
      reason: 'Request timestamp too old (replay attack prevention)',
    };
  }

  // Step 2: Compute expected signature
  const sigBaseString = `v0:${timestamp}:${rawBody}`;
  const expectedSignature =
    'v0=' +
    crypto.createHmac('sha256', signingSecret).update(sigBaseString, 'utf8').digest('hex');

  // Step 3: Timing-safe comparison
  try {
    const signatureBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    if (signatureBuffer.length !== expectedBuffer.length) {
      return { valid: false, reason: 'Signature length mismatch' };
    }

    if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return { valid: false, reason: 'Signature verification failed' };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return {
      valid: false,
      reason: `Signature comparison error: ${errorMsg}`,
    };
  }

  return { valid: true };
}

/**
 * Parse URL-encoded Slack slash command payload
 */
export function parseSlackCommand(body: string): SlackSlashCommand {
  const params = new URLSearchParams(body);
  return {
    token: params.get('token') ?? '',
    team_id: params.get('team_id') ?? '',
    team_domain: params.get('team_domain') ?? '',
    channel_id: params.get('channel_id') ?? '',
    channel_name: params.get('channel_name') ?? '',
    user_id: params.get('user_id') ?? '',
    user_name: params.get('user_name') ?? '',
    command: params.get('command') ?? '',
    text: params.get('text') ?? '',
    response_url: params.get('response_url') ?? '',
    trigger_id: params.get('trigger_id') ?? '',
  };
}

/**
 * Parse deploy command text into service and environment
 */
export function parseDeployCommand(
  text: string
): Result<{ service: ServiceAlias; environment: Environment }, ParseError> {
  const parts = text.trim().split(/\s+/);
  const service = parts[0];
  const environment = parts[1];

  if (service === undefined || service === '') {
    return err({ code: 'MISSING_SERVICE', message: 'Service is required' });
  }

  if (environment === undefined || environment === '') {
    return err({ code: 'MISSING_ENV', message: 'Environment is required' });
  }

  if (!isValidService(service)) {
    return err({
      code: 'INVALID_SERVICE',
      message: `Unknown service: ${service}`,
    });
  }

  if (!isValidEnvironment(environment)) {
    return err({
      code: 'INVALID_ENV',
      message: `Unknown environment: ${environment}`,
    });
  }

  return ok({ service, environment });
}

/**
 * Format Slack ephemeral response (visible only to user)
 */
export function createEphemeralResponse(text: string): SlackResponse {
  return {
    response_type: 'ephemeral',
    text,
  };
}

/**
 * Format Slack in-channel response (visible to everyone)
 */
export function createChannelResponse(text: string): SlackResponse {
  return {
    response_type: 'in_channel',
    text,
  };
}
