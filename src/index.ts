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
  sendDelayedResponse,
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
  getServiceConfig,
  getEnvironmentConfig,
  getHelpMessage,
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

  // Handle help and list commands
  const commandText = command.text.trim().toLowerCase();
  if (commandText === 'help' || commandText === 'list' || commandText === '') {
    res.json(createEphemeralResponse(getHelpMessage()));
    return;
  }

  // Parse deploy command
  const parseResult = parseDeployCommand(command.text);

  if (!parseResult.ok) {
    res.json(
      createEphemeralResponse(
        `:x: ${parseResult.error.message}\n\n` +
          `Type \`/deploy help\` to see available services and usage.`
      )
    );
    return;
  }

  const { service, environment } = parseResult.value;

  // Get service and environment configs
  const serviceConfig = getServiceConfig(service);
  const envConfig = getEnvironmentConfig(environment);

  // Respond immediately to Slack (must be within 3 seconds)
  res.json(
    createEphemeralResponse(
      `:hourglass_flowing_sand: Triggering deployment of *${serviceConfig.displayName}* to *${envConfig.displayName}*...`
    )
  );

  // Process deployment in background and send result via response_url
  const responseUrl = command.response_url;

  // Fire and forget - don't await
  void (async () => {
    try {
      const buildResult = await triggerBuild(envConfig.projectId, serviceConfig.triggerId);

      if (!buildResult.ok) {
        const duration = Date.now() - startTime;

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

        await sendDelayedResponse(
          responseUrl,
          createEphemeralResponse(
            `:x: *Failed to trigger deployment*\n\n` +
              `Error: ${buildResult.error.message}\n\n` +
              `Please check that the trigger exists and you have the correct permissions.`
          )
        );
        return;
      }

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

      await sendDelayedResponse(
        responseUrl,
        createChannelResponse(
          `:rocket: *Deployment triggered!*\n\n` +
            `*Service:* ${serviceConfig.displayName} (\`${service}\`)\n` +
            `*Environment:* ${envConfig.displayName} (\`${environment}\`)\n` +
            `*Build ID:* ${buildResult.value.buildId}\n` +
            `*Triggered by:* <@${userId}>\n\n` +
            `<${buildResult.value.logUrl}|View build logs>`
        )
      );
    } catch (error) {
      console.error('Background deployment error:', error);
      await sendDelayedResponse(
        responseUrl,
        createEphemeralResponse(`:x: Unexpected error during deployment. Check logs.`)
      );
    }
  })();
};
