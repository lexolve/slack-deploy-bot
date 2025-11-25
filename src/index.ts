/**
 * Slack Deploy Bot - Cloud Function Entry Point with strict types
 */

import { type HttpFunction } from '@google-cloud/functions-framework';
import {
  verifySlackRequest,
  parseSlackCommand,
  parseDeployCommand,
  createEphemeralResponse,
  createChannelResponse,
} from './slack';
import { isUserAuthorized, getAuthorizationErrorMessage } from './auth';
import {
  logAuditEvent,
  createSuccessAuditLog,
  createDeniedAuditLog,
  createErrorAuditLog,
} from './audit';
import { triggerBuild } from './cloudbuild';
import {
  SLACK_SIGNING_SECRET,
  validateConfig,
  getValidServices,
  getValidEnvironments,
  getServiceConfig,
  getEnvironmentConfig,
} from './config';
import { asSlackUserId } from './types';

/**
 * Main Cloud Function handler for Slack slash command
 */
export const deployBot: HttpFunction = async (req, res) => {
  const startTime = Date.now();

  // Only accept POST requests
  if (req.method !== 'POST') {
    res.status(405).json(createEphemeralResponse('Method not allowed'));
    return;
  }

  // Validate configuration on startup
  const configValidation = validateConfig();
  if (!configValidation.valid) {
    console.error('Configuration errors:', configValidation.errors);
    res.status(500).json(createEphemeralResponse(':x: Bot configuration error. Please check logs.'));
    return;
  }

  // Get raw body for signature verification
  const rawBody = req.rawBody?.toString('utf8') ?? '';
  const signature = req.headers['x-slack-signature'];
  const timestamp = req.headers['x-slack-request-timestamp'];

  // Verify Slack signature
  if (typeof signature !== 'string' || typeof timestamp !== 'string') {
    res.status(401).json(createEphemeralResponse('Missing security headers'));
    return;
  }

  const verification = verifySlackRequest(SLACK_SIGNING_SECRET, signature, timestamp, rawBody);

  if (!verification.valid) {
    console.error('Signature verification failed:', verification.reason);
    res.status(401).json(createEphemeralResponse('Request verification failed'));
    return;
  }

  // Parse Slack command
  const command = parseSlackCommand(rawBody);
  const userId = asSlackUserId(command.user_id);

  // Check user authorization
  if (!isUserAuthorized(userId)) {
    const duration = Date.now() - startTime;
    await logAuditEvent(
      createDeniedAuditLog(
        userId,
        command.user_name,
        'unknown',
        'unknown',
        'User not authorized',
        duration
      )
    );

    res.json(createEphemeralResponse(getAuthorizationErrorMessage(userId)));
    return;
  }

  // Parse deploy command
  const parseResult = parseDeployCommand(command.text);

  if (!parseResult.ok) {
    const availableServices = getValidServices().join(', ');
    const availableEnvironments = getValidEnvironments().join(', ');
    res.json(
      createEphemeralResponse(
        `:information_source: *Usage:* \`/deploy <service> <environment>\`\n\n` +
          `*Available services:* ${availableServices}\n` +
          `*Available environments:* ${availableEnvironments}\n\n` +
          `*Example:* \`/deploy backend-api staging\`\n\n` +
          `*Error:* ${parseResult.error.message}`
      )
    );
    return;
  }

  const { service, environment } = parseResult.value;

  // Get service and environment configs
  const serviceConfig = getServiceConfig(service);
  const envConfig = getEnvironmentConfig(environment);

  // Trigger Cloud Build
  const buildResult = await triggerBuild(envConfig.projectId, serviceConfig.triggerId);

  if (!buildResult.ok) {
    const duration = Date.now() - startTime;

    // Log error
    await logAuditEvent(
      createErrorAuditLog(
        userId,
        command.user_name,
        service,
        environment,
        buildResult.error.message,
        duration,
        envConfig.projectId,
        serviceConfig.triggerId
      )
    );

    // Send error response
    res.json(
      createEphemeralResponse(
        `:x: *Failed to trigger deployment*\n\n` +
          `Error: ${buildResult.error.message}\n\n` +
          `Please check that the trigger exists and you have the correct permissions.`
      )
    );
    return;
  }

  // Log successful deployment
  const duration = Date.now() - startTime;
  await logAuditEvent(
    createSuccessAuditLog(
      userId,
      command.user_name,
      service,
      environment,
      envConfig.projectId,
      serviceConfig.triggerId,
      buildResult.value.buildId,
      duration
    )
  );

  // Send success response to channel
  res.json(
    createChannelResponse(
      `:rocket: *Deployment triggered!*\n\n` +
        `*Service:* ${serviceConfig.displayName} (\`${service}\`)\n` +
        `*Environment:* ${envConfig.displayName} (\`${environment}\`)\n` +
        `*Build ID:* ${buildResult.value.buildId}\n` +
        `*Triggered by:* <@${userId}>\n\n` +
        `<${buildResult.value.logUrl}|View build logs>`
    )
  );
};
