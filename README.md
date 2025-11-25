# Slack Deploy Bot

Type-safe Slack bot for triggering GCP Cloud Build deployments across multiple environments.

## Features

- **Slash commands**: `/deploy <service> <environment>`
- **Strict TypeScript**: Branded types, Result pattern, no `any`
- **Secure**: HMAC-SHA256 signature verification, user allowlist
- **Audit logging**: All deployments logged to Cloud Logging
- **Multi-project**: Triggers builds in different GCP projects per environment

## Prerequisites

1. **GCP Setup**: Terraform to create service accounts, secrets, and IAM permissions
2. **Slack App**: Created at api.slack.com/apps

## GCP Infrastructure Setup

The bot requires:
- Service account with `cloudbuild.builds.editor` on target projects
- Secret Manager secret for Slack signing secret
- IAM permissions to access the secret

**Example Terraform:**
```hcl
resource "google_service_account" "slack_deploy_bot" {
  account_id   = "slack-deploy-bot"
  display_name = "Slack Deploy Bot"
}

resource "google_secret_manager_secret" "slack_signing_secret" {
  secret_id = "slack-signing-secret"
  replication { auto {} }
}

resource "google_project_iam_member" "cloudbuild_permissions" {
  for_each = toset([var.staging_project_id, var.prod_project_id])
  project  = each.key
  role     = "roles/cloudbuild.builds.editor"
  member   = "serviceAccount:${google_service_account.slack_deploy_bot.email}"
}
```

**After Terraform**, add the secret value:
```bash
echo -n "YOUR_SLACK_SIGNING_SECRET" | gcloud secrets versions add slack-signing-secret \
  --data-file=- \
  --project=YOUR_PROJECT_ID
```

## Quick Setup

### 1. Configure Services

Edit `src/config.ts` and add your Cloud Build trigger IDs:

```typescript
export const SERVICES = {
  'backend-api': {
    triggerId: asTriggerId('YOUR-TRIGGER-ID'),
    displayName: 'Backend API',
  },
} as const;
```

**Find trigger IDs:**
```bash
gcloud builds triggers list --project=YOUR_PROJECT --format="table(id,name)"
```

### 2. Create Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. **Create New App** → **From scratch**
3. Name: "Deploy Bot"
4. **Slash Commands** → **Create New Command**:
   - Command: `/deploy`
   - Request URL: (update after deployment)
   - Short Description: "Trigger a deployment"
   - Usage Hint: `<service> <environment>`
5. **Basic Information** → Copy **Signing Secret** (add to Secret Manager)

### 3. Get Slack User IDs

Click user profile → **...** → **Copy member ID** (format: `U12345ABC`)

### 4. Deploy Function

```bash
# Load environment variables
export PROJECT_ID="your-gcp-project"
export STAGING_PROJECT_ID="your-staging-project"
export PROD_PROJECT_ID="your-prod-project"
export ALLOWED_USERS="U12345ABC,U67890DEF"

# Deploy
./deploy.sh
```

Copy the Function URL from output.

### 5. Update Slack App

1. Go to Slack app → **Slash Commands** → Edit `/deploy`
2. Update **Request URL** with Function URL
3. **Install App** → **Reinstall to Workspace**

## Usage

```bash
/deploy backend-api staging
/deploy frontend prod
```

## Project Structure

```
src/
├── index.ts          # Cloud Function entry point
├── types.ts          # Branded types, discriminated unions
├── result.ts         # Result<T,E> pattern
├── config.ts         # Service/env mappings (const assertions)
├── slack.ts          # Signature verification, parsing
├── auth.ts           # User authorization
├── audit.ts          # Audit logging
└── cloudbuild.ts     # Cloud Build API client
```

## Type Safety

### Branded Types
```typescript
type SlackUserId = Brand<string, 'SlackUserId'>;
type TriggerId = Brand<string, 'TriggerId'>;
type ProjectId = Brand<string, 'ProjectId'>;
```

### Result Pattern
```typescript
const result = await triggerBuild(projectId, triggerId);
if (result.ok) {
  console.log(result.value.buildId);
} else {
  console.error(result.error.message);
}
```

### Discriminated Unions
```typescript
type AuditLog =
  | { status: 'SUCCESS'; buildId: string }
  | { status: 'DENIED'; reason: string }
  | { status: 'ERROR'; errorMessage: string };
```

## Adding Services

1. Get trigger ID:
   ```bash
   gcloud builds triggers list --project=YOUR_PROJECT
   ```

2. Edit `src/config.ts`:
   ```typescript
   export const SERVICES = {
     'new-service': {
       triggerId: asTriggerId('trigger-id'),
       displayName: 'New Service',
     },
   } as const;
   ```

3. Redeploy:
   ```bash
   npm run build
   ./deploy.sh
   ```

## Audit Logs

```bash
gcloud logging read \
  "resource.type=cloud_function AND logName=projects/YOUR_PROJECT/logs/slack-deploy-bot-audit" \
  --limit=50 \
  --project=YOUR_PROJECT
```

## Security

- **Signature verification**: HMAC-SHA256, timing-safe
- **Replay protection**: 5-minute timestamp window
- **User allowlist**: Only authorized users can deploy
- **Minimal IAM**: Only `cloudbuild.builds.editor` role
- **Secret Manager**: Credentials encrypted at rest

## Development

```bash
npm install
npm run build  # Compile TypeScript with strict checks
```

## Troubleshooting

**401 Unauthorized**
- Check `SLACK_SIGNING_SECRET` in Secret Manager matches Slack app

**User not authorized**
- Verify Slack user ID in `ALLOWED_USERS` environment variable

**Failed to trigger build**
- Verify trigger exists in the correct project
- Check service account has `cloudbuild.builds.editor` role

## License

MIT
