/**
 * Google Cloud Build API client with Result pattern (no any types)
 */

import { CloudBuildClient } from '@google-cloud/cloudbuild';
import { type BuildResult, type CloudBuildError, type TriggerId, type ProjectId, asProjectId } from './types';
import { type Result, ok, err } from './result';

// Initialize Cloud Build client
const client = new CloudBuildClient();

/**
 * Type guard to check if value is a record
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard for operation metadata structure
 */
function hasValidBuildMetadata(
  metadata: unknown
): metadata is { build: { id: string } } {
  if (!isRecord(metadata)) {
    return false;
  }

  const build = metadata['build'];
  if (!isRecord(build)) {
    return false;
  }

  const id = build['id'];
  return typeof id === 'string' && id.length > 0;
}

/**
 * Convert unknown error to CloudBuildError
 */
function toCloudBuildError(error: unknown): CloudBuildError {
  if (error instanceof Error) {
    // Check for GCP error codes in message
    if (error.message.includes('NOT_FOUND') || error.message.includes('404')) {
      return {
        code: 'TRIGGER_NOT_FOUND',
        message: 'Cloud Build trigger not found',
        originalError: error,
      };
    }
    if (error.message.includes('PERMISSION_DENIED') || error.message.includes('403')) {
      return {
        code: 'PERMISSION_DENIED',
        message: 'Permission denied to trigger build',
        originalError: error,
      };
    }
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message,
      originalError: error,
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: String(error),
    originalError: error,
  };
}

/**
 * Trigger a Cloud Build deployment
 * @param projectId GCP project ID where the trigger exists
 * @param triggerId Cloud Build trigger ID
 * @returns Result with build information or error
 */
export async function triggerBuild(
  projectId: ProjectId,
  triggerId: TriggerId
): Promise<Result<BuildResult, CloudBuildError>> {
  try {
    const [operation] = await client.runBuildTrigger({
      projectId,
      triggerId,
      source: {
        branchName: 'main',
      },
    });

    // Extract metadata with proper type checking
    const metadata = operation.metadata;

    if (!hasValidBuildMetadata(metadata)) {
      return err({
        code: 'INVALID_RESPONSE',
        message: 'Invalid operation metadata from Cloud Build API',
      });
    }

    const buildId = metadata.build.id;
    const logUrl = `https://console.cloud.google.com/cloud-build/builds/${buildId}?project=${projectId}`;

    return ok({
      buildId,
      logUrl,
      projectId: asProjectId(projectId),
    });
  } catch (error) {
    return err(toCloudBuildError(error));
  }
}
