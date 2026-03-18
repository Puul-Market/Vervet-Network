# Vervet Dashboard

Partner operations dashboard for Vervet Network. This foundation is built on
Next.js and reads the hardened backend APIs for:

- admin-token-based partner onboarding via `/setup`
- partner user sign-in and encrypted dashboard sessions
- partner profile, API credential, and signing-key access management
- recipient resolution and pasted-address verification
- recipient registry and current destination assignments
- recent attestation activity by recipient
- webhook endpoint lifecycle management
- webhook delivery history
- partner-scoped audit logs
- encrypted cookie-backed dashboard sessions

## Environment

Create `dashboard/.env.local` with:

```bash
VERVET_API_BASE_URL="http://localhost:3000"
DASHBOARD_SESSION_SECRET="replace-with-a-long-random-string-at-least-32-characters"
```

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

The sign-in form expects a partner user email and password. Dashboard access is
granted from the scopes attached to that partner user account. The current UI
expects the user to have:

- `partners:read`
- `partners:write`
- `resolution:read`
- `recipients:read`
- `attestations:read`
- `webhooks:write`
- `webhooks:read`
- `audit:read`

Admin onboarding at `/setup` expects the backend `ADMIN_API_TOKEN`, which is
validated against `GET /v1/partners/setup/status` and then used to create the
partner, register the first signing key, and create the first owner user.

## Build checks

```bash
npm run lint
npm run build
```

Browser regression commands:

```bash
npm run test:playwright:admin-setup-entry
npm run test:playwright:external:state
npm run test:playwright:external:mutations
npm run test:playwright:external
```
