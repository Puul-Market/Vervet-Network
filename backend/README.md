# Vervet Network Backend

NestJS backend for recipient-first wallet resolution, partner-backed destination attestations, and pasted-address verification.

## Local Development

### 1. Start PostgreSQL

From the repository root:

```bash
docker compose up -d postgres
```

The database listens on `localhost:54329`.

### 2. Install dependencies

```bash
cd backend
npm install
```

### 3. Configure environment

Copy `.env.example` to `.env` and adjust the values for the environment you are running.
`ADMIN_API_TOKEN` is required for bootstrap/admin routes.
`WEBHOOK_SIGNING_MASTER_SECRET` is required for outbound webhook signatures.
`WEBHOOK_DELIVERY_PROCESSOR_*` controls the automated delivery worker.
`CORS_ALLOWED_ORIGINS` should be set to the dashboard/browser origins allowed to call the API.
`DATABASE_POOL_MAX` sets the PostgreSQL pool ceiling for the API process.
`DATABASE_APPLICATION_NAME` labels backend connections in `pg_stat_activity`.
`PARTNER_DASHBOARD_SESSION_*` controls dashboard session lifetime and usage writeback.

### 4. Generate the Prisma client

```bash
npm run prisma:generate
```

### 5. Apply migrations and seed base data

```bash
npm run db:migrate:deploy
npm run db:seed
```

### 6. Start the API

```bash
npm run start:dev
```

The API base path is `http://localhost:3000/v1`.
Interactive API docs are exposed at `http://localhost:3000/docs`, with raw OpenAPI JSON at `http://localhost:3000/docs/json`.

## Production PostgreSQL TLS

For AWS RDS or any managed PostgreSQL service that requires encrypted
connections, prefer verified TLS instead of `sslmode=no-verify`.

Example with the AWS RDS global bundle:

```bash
mkdir -p /opt/vervet/certs
curl -fsSL https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem \
  -o /opt/vervet/certs/rds-global-bundle.pem
```

Then set `DATABASE_URL` with both `sslmode=verify-full` and
`sslrootcert=<absolute-path>`:

```bash
DATABASE_URL="postgresql://<user>:<password>@<host>:5432/<database>?schema=public&sslmode=verify-full&sslrootcert=/opt/vervet/certs/rds-global-bundle.pem"
```

If the process manager does not automatically reload `.env`, restart the API
after updating the certificate path or database URL.

Recommended production connection metadata:

```bash
DATABASE_POOL_MAX=10
DATABASE_APPLICATION_NAME="vervet-backend"
```

## Core Endpoints

- `GET /v1/health`
- `POST /v1/partners`
- `POST /v1/partners/users`
- `POST /v1/partners/signing-keys`
- `POST /v1/partners/api-credentials`
- `POST /v1/dashboard-auth/login`
- `POST /v1/dashboard-auth/logout`
- `GET /v1/audit-logs`
- `GET /v1/webhooks`
- `GET /v1/webhooks/deliveries`
- `POST /v1/webhooks`
- `PATCH /v1/webhooks/:endpointId`
- `POST /v1/webhooks/:endpointId/rotate-secret`
- `DELETE /v1/webhooks/:endpointId`
- `POST /v1/webhooks/deliveries/process`
- `POST /v1/attestations`
- `POST /v1/resolution/resolve`
- `POST /v1/resolution/verify`

## Admin Bootstrap Auth

Partner bootstrap endpoints are protected with:

```http
X-Admin-Token: <ADMIN_API_TOKEN>
```

Protected routes:

- `POST /v1/partners`
- `POST /v1/partners/users`
- `POST /v1/partners/signing-keys`
- `POST /v1/partners/api-credentials`
- `POST /v1/webhooks/deliveries/process`

## Partner Auth

`POST /v1/attestations`, `POST /v1/resolution/resolve`, and
`POST /v1/resolution/verify` are protected with bearer-token partner
authentication.

Credential bootstrap flow:

```bash
# 1. Create the partner
POST /v1/partners

# 2. Register the partner signing key
POST /v1/partners/signing-keys

# 3. Issue a partner API credential
POST /v1/partners/api-credentials
```

The API credential response includes the plaintext `secret` exactly once. Store it securely. Subsequent attestation writes must send:

```http
Authorization: Bearer <secret>
```

Supported scopes:

- `attestations:write`
- `audit:read`
- `resolution:read`
- `webhooks:write`
- `webhooks:read`

## Dashboard Auth

Human operators should sign in with partner user accounts, not API credentials.

Admin bootstrap flow:

```bash
# 1. Create the partner
POST /v1/partners

# 2. Register the initial signing key
POST /v1/partners/signing-keys

# 3. Create the first owner user
POST /v1/partners/users
```

Dashboard login:

```http
POST /v1/dashboard-auth/login
Content-Type: application/json

{
  "email": "ops@example.com",
  "password": "long-password"
}
```

The response includes a `vds_...` dashboard session token. Authenticated dashboard
requests send:

```http
Authorization: Bearer <dashboard-session-token>
```

Dashboard session tokens can access the same partner-scoped operational routes as
API credentials, but attestation replay protection still requires an API
credential because it is tied to credential-specific nonces.

### Attestation replay protection

Attestation writes now require request freshness headers in addition to the
partner signature:

```http
Authorization: Bearer <secret>
X-Request-Nonce: <unique-random-request-id>
X-Request-Timestamp: <ISO-8601 timestamp or epoch milliseconds>
```

The backend rejects:

- missing or malformed replay headers
- stale timestamps outside the configured freshness window
- reused nonces for the same API credential

Relevant environment variables:

- `ATTESTATION_REQUEST_MAX_AGE_MS`
- `ATTESTATION_REQUEST_NONCE_TTL_MS`

Attestation ingestion only accepts pre-registered chain/asset/corridor records. Partners cannot create new chains, assets, or asset networks through the attestation write path.

### Resolution lookup hardening

Resolution routes require a credential with `resolution:read`.

Optional idempotent retry support:

```http
Authorization: Bearer <secret>
Idempotency-Key: <client-generated-id>
```

The backend returns the stored response when the same partner retries the same
resolution request with the same idempotency key. Reusing the same key with a
different request payload returns `409 Conflict`.

Resolution lookups are also protected by:

- partner-scoped rate limiting
- distinct-identifier anti-enumeration controls
- `BLOCKED` request logging with partner-scoped audit records

Relevant environment variables:

- `RESOLUTION_LOOKUP_RATE_LIMIT_WINDOW_MS`
- `RESOLUTION_LOOKUP_RATE_LIMIT_MAX_REQUESTS`
- `RESOLUTION_LOOKUP_ENUMERATION_WINDOW_MS`
- `RESOLUTION_LOOKUP_ENUMERATION_MAX_IDENTIFIERS`
- `RESOLUTION_REQUEST_RETENTION_MS`

## Automated Worker

The backend can process due webhook retries automatically inside the service process.

Relevant environment variables:

- `WEBHOOK_ALLOW_PRIVATE_TARGETS`
- `WEBHOOK_DELIVERY_PROCESSOR_ENABLED`
- `WEBHOOK_DELIVERY_PROCESSOR_INTERVAL_MS`
- `WEBHOOK_DELIVERY_PROCESSOR_BATCH_SIZE`
- `WEBHOOK_DELIVERY_PROCESSING_STALE_MS`

Webhook endpoints are restricted to HTTP(S) URLs. In production, they should resolve only to publicly routable hosts unless `WEBHOOK_ALLOW_PRIVATE_TARGETS=true` is explicitly enabled for non-production testing.

In test environments the worker is disabled by default. In local development and production it is enabled by default unless explicitly turned off.

## Audit Logs

Partners can read their own scoped audit trail with a credential that has `audit:read`:

- `GET /v1/audit-logs`

Supported filters:

- `action`
- `actorType`
- `entityType`
- `entityId`
- `limit`

## Webhooks

Partners can register webhook endpoints with a credential that has `webhooks:write`, then list them with `webhooks:read`.

Partner-managed webhook routes:

- `GET /v1/webhooks`
- `GET /v1/webhooks/deliveries`
- `POST /v1/webhooks`
- `PATCH /v1/webhooks/:endpointId`
- `POST /v1/webhooks/:endpointId/rotate-secret`
- `DELETE /v1/webhooks/:endpointId`

Partners can inspect delivery history with:

- `GET /v1/webhooks/deliveries`

Supported filters:

- `endpointId`
- `status`
- `eventType`
- `limit`

Webhook requests include:

```http
X-Vervet-Delivery-Id: <delivery-id>
X-Vervet-Event: DESTINATION_UPDATED | DESTINATION_REVOKED
X-Vervet-Timestamp: <ISO-8601 timestamp>
X-Vervet-Signature: v1=<hex hmac>
```

The signature is HMAC-SHA256 over:

```text
<timestamp>.<raw-json-payload>
```

using the per-endpoint signing secret returned exactly once during webhook endpoint creation.

Webhook failures are retried with exponential backoff up to five attempts. Failed pending deliveries can also be processed manually with:

```http
POST /v1/webhooks/deliveries/process
X-Admin-Token: <ADMIN_API_TOKEN>
```

Optional request body:

```json
{
  "limit": 50,
  "ignoreSchedule": false
}
```

Setting `ignoreSchedule` to `true` lets an operator force immediate processing of pending deliveries.

## Audit Log Events

Sensitive write operations emit records into the `AuditLog` table, including:

- partner creation
- signing key registration
- API credential issuance
- attestation ingestion
- webhook endpoint creation, updates, disablement, and secret rotation
- webhook delivery abandonment

## Notes

- The first seeded corridors are Ethereum, Tron, Solana, Base, and BNB Smart Chain, with seeded USDC support on Ethereum, Tron, Solana, Base, and BNB Smart Chain.

## Verification

```bash
npm run build
npm run lint
npm test -- --runInBand
npm run test:e2e -- --runInBand
```
