#!/bin/bash
set -e

# Slack Deploy Bot - Deployment Script for europe-north1

# Check required environment variables
if [ -z "$ALLOWED_USERS" ]; then
  echo "Error: ALLOWED_USERS environment variable is required (comma-separated Slack user IDs)"
  exit 1
fi

if [ -z "$PROJECT_ID" ]; then
  echo "Error: PROJECT_ID environment variable is required (GCP project where function is deployed)"
  exit 1
fi

if [ -z "$STAGING_PROJECT_ID" ]; then
  echo "Error: STAGING_PROJECT_ID environment variable is required"
  exit 1
fi

if [ -z "$PROD_PROJECT_ID" ]; then
  echo "Error: PROD_PROJECT_ID environment variable is required"
  exit 1
fi

# Configuration
REGION="${FUNCTION_REGION:-europe-north1}"
FUNCTION_NAME="slack-deploy-bot"
SERVICE_ACCOUNT="${FUNCTION_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "========================================="
echo "Deploying Slack Deploy Bot"
echo "========================================="
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Function: ${FUNCTION_NAME}"
echo "Service Account: ${SERVICE_ACCOUNT}"
echo "========================================="
echo ""

# Build TypeScript
echo "Building TypeScript..."
npm run build

echo ""
echo "Deploying to Cloud Run Functions (Gen 2)..."
gcloud functions deploy ${FUNCTION_NAME} \
  --gen2 \
  --runtime=nodejs20 \
  --region=${REGION} \
  --source=. \
  --entry-point=deployBot \
  --trigger-http \
  --allow-unauthenticated \
  --service-account=${SERVICE_ACCOUNT} \
  --set-secrets="SLACK_SIGNING_SECRET=slack-signing-secret:latest" \
  --set-env-vars="ALLOWED_USERS=${ALLOWED_USERS},STAGING_PROJECT_ID=${STAGING_PROJECT_ID},PROD_PROJECT_ID=${PROD_PROJECT_ID},FUNCTION_REGION=${REGION}" \
  --project=${PROJECT_ID}

echo ""
echo "========================================="
echo "Deployment complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Copy the Function URL from the output above"
echo "2. Go to https://api.slack.com/apps"
echo "3. Select your app -> Slash Commands -> Edit /deploy"
echo "4. Update Request URL with the Function URL"
echo "5. Save and reinstall the app to your workspace"
echo ""
