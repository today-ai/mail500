# Dispatch Marketing

Standalone email marketing dashboard for one administrator. Add contacts, import/export CSV, save company and sender settings, select subscribers into named lists of up to 500, and review delivery statistics and recipient reports.

## Run locally

Requires Node.js 24 or later. No external runtime packages are required.

1. Copy `dispatch/.env.example` to `dispatch/.env`.
2. Set a strong `ADMIN_PASSWORD` (at least 16 characters) and stable `UNSUBSCRIBE_SECRET` (at least 32 characters).
3. Run `npm start` from the repository root. Open `http://localhost:3080`.

Run `npm test` for backend tests; all provider responses are mocked and no real emails are sent. Run `npm run build` for JavaScript syntax checks.

## Hostinger deployment

Connect this private repository to the Node.js application in your existing Hostinger plan. Use the repository root, Node.js 24 or later, build command `npm run build`, and start command `npm start`. Allow Hostinger to supply its `PORT`; the server listens on `0.0.0.0` in production. Verify that Node.js 24 is available before deploying: the database uses built-in `node:sqlite`.

Set these values through the hosting environment panel, never in GitHub:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `APP_URL` | Public HTTPS URL of the application |
| `ADMIN_PASSWORD` | Unique strong administrator password |
| `UNSUBSCRIBE_SECRET` | Stable random secret, at least 32 characters |
| `DATABASE_PATH` | Absolute path on verified persistent, writable storage |
| `RESEND_API_KEY` | Server-side Resend API key |
| `RESEND_DOMAIN_ID` | Verified sending domain ID |
| `RESEND_WEBHOOK_ID` | Webhook ID |
| `RESEND_WEBHOOK_SECRET` | Webhook signing secret |
| `ALLOW_SEND` | `false` during setup |

Run exactly one application instance. Before adding real contacts, confirm that the database path survives restarts and redeployments. Do not use an ephemeral checkout for SQLite. Configure backups outside the deployment directory. If Hostinger does not offer suitable persistent storage, the database integration must be changed before live use.

The current batch worker still sends using the Resend HTTPS API. A server-side remote MCP client now supports authenticated quota checks and unsent broadcast drafts, with JSON/SSE responses and no automatic mutation retries. The authenticated GET /api/mcp/readiness endpoint checks the MCP connection. Marketing sends through MCP must use broadcasts: segment synchronization, persisted broadcast IDs, send reconciliation and webhook mapping remain to be integrated before enabling this route for live batches. The Codex connector's authentication is separate from deployed application credentials.

## First batch

Save company name, physical address, From/Reply-to addresses and email content in Settings. Import only subscribers with opt-in evidence and a consent date. Create a named list such as `Batch 1`, then create more lists as required. The audience filter can show contacts not in an existing batch.

Configure domain authentication including SPF/DKIM/DMARC. Set the Resend webhook endpoint to `APP_URL/webhooks/resend` and subscribe to `email.delivered`, `email.bounced`, `email.complained`, and `email.failed`; optional opened/clicked events enable engagement statistics. Send a test to your own address and wait for its verified delivered webhook. The app checks account quota and readiness before sending; only enable `ALLOW_SEND=true` after setup. Each batch requires explicit review and confirmation in the dashboard.

Sending uses a persistent recipient queue, stable idempotency keys, suppression checks, signed unsubscribe links, webhook deduplication and automatic pauses on complaints or elevated bounces. Unknown provider requests older than the idempotency window require reconciliation rather than blind retries.

## Deployment status

Repository preparation does not mean production deployment is complete. Hostinger storage, runtime, domain, HTTPS, environment variables, webhooks and a delivered test still require verification. Credentials, subscriber records, database files and backups are excluded from version control.
