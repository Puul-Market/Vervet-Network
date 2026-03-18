# Implementation Plan

## Problem Statement
The V2 external dashboard has the right route structure and operational surfaces, but it still treats every external organization as if it were the same kind of partner. V3 upgrades the existing platform console into an adaptive workspace that understands:

- whether the organization is an API consumer, a data partner, or both
- whether it is sandbox-only or production-approved
- how far through onboarding it is
- which modules should be visible, read-only, or unavailable

This is not a route-architecture reset. It is a capability, readiness, and onboarding layer added on top of the existing dashboard and backend.

## Current Focus
Phase 46 is complete. The platform dashboard now explains the signed data-partner ingestion model directly in the product, instead of assuming partners already know how trust data is supposed to reach Vervet. Setup, API docs, and the first-attestation feed-health state now share a backend-owned guide with the signed attestation flow, operational notes, and inline request examples. The next focus is Phase 47: run a browser QA pass for the new ingestion guidance and decide whether Vervet wants to formalize a separate non-attestation data-feed ingestion model.

## Phase 46 Scope
- make the signed data-partner ingestion model explicit inside the dashboard instead of leaving it implicit in the backend and docs
- add a canonical backend-owned guide for:
  - register signing key
  - issue API key
  - sign and send the first attestation
  - confirm the result in Data Feed Health
- add inline example payload and cURL snippets so a first-time data partner can see the real write path without leaving the product
- surface the same guidance in:
  - `/setup`
  - `/docs/api`
  - `/data-feed-health` when the org is waiting for the first signed trust update

## Phase 46 Backend Changes
- extend partner dashboard metadata with a `dataSubmission` guide under `guidance`
- make the guide backend-owned so setup, docs, and feed-health use the same source of truth
- include:
  - operational steps
  - important trust-model notes
  - `/v1/attestations` endpoint path
  - example attestation payload
  - example cURL request
- cover the new metadata shape in the dashboard metadata e2e suite

## Phase 46 Frontend Changes
- add a reusable data-partner ingestion guide component
- render that guide in the external onboarding home for data-contributing partners
- render the same guide in API docs for data partners and combined partners
- render the guide in Data Feed Health when a partner has not yet landed its first attestation

## Phase 46 Files Expected
- `backend/src/partners/dashboard-metadata.service.ts`
- `backend/test/dashboard-metadata.e2e-spec.ts`
- `dashboard/src/components/data-partner-ingestion-guide.tsx`
- `dashboard/src/components/partner-onboarding-home.tsx`
- `dashboard/src/app/(ops)/docs/api/page.tsx`
- `dashboard/src/app/(ops)/data-feed-health/page.tsx`
- `dashboard/src/lib/vervet-api.ts`

## Phase 46 Verification
- `backend`: `npm run build`
- `backend`: `npm run lint`
- `backend`: `npm run test:e2e -- --runInBand test/dashboard-metadata.e2e-spec.ts`
- `dashboard`: `npm run lint`
- `dashboard`: `npm run build`
- Phase 46 verification passed after adding backend-owned ingestion guidance metadata, wiring the shared guide into setup/docs/feed-health, and covering the new metadata contract in e2e.

## Phase 45 Scope
- remove the remaining backend-owned hardcoded dashboard data that still risked drifting from the source of truth
- expose backend metadata endpoints for:
  - asset-network corridor choices
  - partner/admin option sets used in filters and forms
  - onboarding task definitions and partner guidance
  - sandbox presets and sample responses
- rewire the dashboard so those values are fetched from the backend instead of local constants
- delete obsolete frontend-only metadata files once the dashboard is fully backend-driven

## Phase 45 Backend Changes
- add partner-facing dashboard metadata support under the partner module
- add:
  - `GET /v1/partners/me/dashboard-metadata`
  - `GET /v1/partners/setup/metadata`
- enrich `GET /v1/partners/me` with backend-owned descriptive fields for:
  - next recommended onboarding action label
  - production-approval blocked-reason description
- cover the metadata routes with backend e2e tests

## Phase 45 Frontend Changes
- replace `network-options.ts` corridor constants with backend-provided asset-network metadata
- replace frontend-maintained option lists for recipients, destinations, attestations, webhooks, access, audit, and admin setup forms with backend metadata
- replace hardcoded onboarding checklist definitions, upgrade guidance, and blocked-reason copy with backend metadata
- replace hardcoded sandbox presets, starter batch input, and sample response content with backend metadata
- remove the obsolete frontend-only metadata helper files once all consumers are migrated

## Phase 45 Files Expected
- `backend/src/partners/dashboard-metadata.constants.ts`
- `backend/src/partners/dashboard-metadata.service.ts`
- `backend/src/partners/partner-account.controller.ts`
- `backend/src/partners/partners.controller.ts`
- `backend/test/dashboard-metadata.e2e-spec.ts`
- `dashboard/src/lib/dashboard-metadata.ts`
- `dashboard/src/lib/vervet-api.ts`
- `dashboard/src/app/setup/page.tsx`
- `dashboard/src/components/partner-onboarding-home.tsx`
- `dashboard/src/components/admin-setup-workspace.tsx`
- `dashboard/src/app/(ops)/sandbox/page.tsx`
- `dashboard/src/app/(ops)/docs/page.tsx`

## Phase 45 Verification
- `backend`: `npm run build`
- `backend`: `npm run lint`
- `backend`: `npm test -- --runInBand`
- `backend`: `npm run test:e2e -- --runInBand`
- `dashboard`: `npm run lint`
- `dashboard`: `npm run build`
- Phase 45 verification passed after introducing the new dashboard metadata endpoints, rewiring the remaining option/guidance consumers to backend metadata, and removing the old frontend-only network/guidance constants.

## Phase 44 Scope
- add backend CI coverage for the quality gates already used locally:
  - Prisma validate
  - Prisma generate
  - build
  - lint
  - unit tests
  - e2e tests
- decide whether the dashboard browser workflow should remain monolithic or be split into faster parallel jobs
- keep the existing local commands intact while adding CI-facing script entry points for the split dashboard browser jobs

## Phase 44 Backend / Ops Changes
- add a dedicated backend GitHub Actions workflow under `.github/workflows/`
- provision PostgreSQL in CI and run the full backend quality path against a migrated and seeded database
- keep workflow env requirements explicit instead of relying on checked-in local `.env` state

## Phase 44 Frontend Changes
- split the external dashboard Playwright path into:
  - admin setup entry smoke
  - state-oriented browser regression
  - mutation-oriented browser regression
- extend the ordered Playwright runner so it can execute selected suites from the canonical ordered suite list
- keep the existing `test:playwright:external` command as the full local aggregate path

## Phase 44 Files Expected
- `.github/workflows/backend-quality.yml`
- `.github/workflows/external-dashboard-regression.yml`
- `dashboard/package.json`
- `dashboard/scripts/run-external-playwright.mjs`

## Phase 44 Verification
- `backend`: `npm run prisma:validate`
- `backend`: `npm run prisma:generate`
- `backend`: `npm run db:seed`
- `backend`: `npm run build`
- `backend`: `npm run lint`
- `backend`: `npm test -- --runInBand`
- `backend`: `npm run test:e2e -- --runInBand`
- `dashboard`: `npm run lint`
- `dashboard`: `npm run build`
- `dashboard`: `npm run test:playwright:admin-setup-entry`
- `dashboard`: `npm run test:playwright:external:state`
- `dashboard`: `npm run test:playwright:external:mutations`
- Phase 44 verification passed after adding `.github/workflows/backend-quality.yml`, splitting `.github/workflows/external-dashboard-regression.yml` into parallel smoke/state/mutation jobs, and extending `dashboard/scripts/run-external-playwright.mjs` plus `dashboard/package.json` with the new split browser commands.

## Phase 43 Scope
- add a CI workflow for the dashboard/browser matrix instead of relying on local-only execution
- make the CI job responsible for:
  - booting PostgreSQL
  - installing backend and dashboard dependencies
  - generating Prisma client, applying migrations, and reseeding
  - linting and building the dashboard
  - running the full external browser regression path
- add a separate Playwright smoke test for the `/setup` admin token entry flow so the token-entry UX is still covered even though the aggregate suites now use a sealed admin-session helper
- keep the admin setup entry smoke as a standalone command so it can fail independently from the larger external matrix

## Phase 43 Backend / Ops Changes
- add a GitHub Actions workflow under `.github/workflows/`
- configure the workflow with a PostgreSQL service and the minimum required backend/dashboard environment variables
- reuse the existing backend migration and seed commands instead of inventing a CI-only bootstrap path

## Phase 43 Frontend Changes
- add a dedicated Playwright spec for the admin setup entry form:
  - valid admin token reaches the internal review workspace
  - invalid token shows an inline error state
- add a package script for the dedicated admin setup entry smoke
- keep the full external regression command unchanged for the seeded partner-state matrix

## Phase 43 Files Expected
- `.github/workflows/external-dashboard-regression.yml`
- `dashboard/package.json`
- `dashboard/tests/e2e/admin-setup-entry.spec.ts`

## Phase 43 Verification
- `backend`: `npm run db:seed`
- `dashboard`: `npm run lint`
- `dashboard`: `npm run build`
- `dashboard`: `npm run test:playwright -- tests/e2e/admin-setup-entry.spec.ts`
- `dashboard`: `npm run test:playwright:external`
- CI workflow definition is present and uses the same seeded regression path with explicit env configuration
- Phase 43 verification passed after adding `.github/workflows/external-dashboard-regression.yml`, introducing `dashboard/tests/e2e/admin-setup-entry.spec.ts`, and adding the dedicated `test:playwright:admin-setup-entry` package script.

## Phase 42 Scope
- consolidate the Playwright coverage added across Phases 35 to 41 into a single CI-friendly browser regression path
- add an aggregate dashboard browser command or grouped suite execution for:
  - partner-state matrix
  - role/admin matrix
  - partner/admin mutation flows
  - trust-object and governance mutation flows
  - access/security and onboarding approval flows
- verify that the full browser matrix remains deterministic when run after a fresh reseed instead of only as isolated targeted files
- keep the implementation focused on test-runtime ergonomics and regression confidence rather than new product surface area

## Phase 42 Frontend Changes
- add an aggregate Playwright command or grouped runner configuration in the dashboard package
- add any minor selector/test-fixture cleanup needed so the full suite can run together reliably
- preserve targeted file-level commands for focused debugging

## Phase 42 Files Expected
- `dashboard/package.json`
- optional Playwright config or helper updates

## Phase 42 Verification
- `backend`: `npm run db:seed`
- `dashboard`: `npm run lint`
- `dashboard`: `npm run build`
- `dashboard`: run the full grouped Playwright regression command covering the external dashboard matrix
- the combined browser run should pass cleanly after a fresh reseed without relying on per-file isolation
- Phase 42 verification passed after replacing the fragile single-invocation aggregation with `dashboard/scripts/run-external-playwright.mjs`, executing each suite in its own ordered Playwright process, and switching the admin review suites from the flaky `/setup` token-entry form prerequisite onto a sealed admin-session helper.

## Phase 41 Scope
- extend browser mutation coverage into the remaining high-sensitivity partner journeys that are still primarily API- or unit-verified
- cover:
  - signing-key registration and revocation
  - partner-side production approval request and cancellation
  - security settings mutation
  - invite acceptance or first-user onboarding completion flow
- keep the suites deterministic by continuing to reseed before browser runs and using unique labels where write paths create new records

## Phase 41 Backend Changes
- no new backend product surface is required if the current signing-key, security, invite, and production-request routes remain stable
- continue to reuse the existing seeded QA users plus admin token path

## Phase 41 Frontend Changes
- add one or more Playwright suites for:
  - partner access/security mutation flows
  - partner-side onboarding approval request/cancel flows
- reuse the seeded owner, developer, analyst, and admin credentials already established in prior phases
- use first-owner onboarding completion through `/setup` as the browser-covered substitute for invite acceptance, since invite acceptance still exists only as an API path and not as a dedicated dashboard route

## Phase 41 Files Expected
- `dashboard/tests/e2e/partner-access-security-mutations.spec.ts`
- `dashboard/tests/e2e/partner-onboarding-approval.spec.ts`

## Phase 41 Verification
- `backend`: `npm run db:seed`
- `dashboard`: `npm run lint`
- `dashboard`: `npm run build`
- `dashboard`: `npm run test:playwright -- tests/e2e/partner-access-security-mutations.spec.ts`
- `dashboard`: `npm run test:playwright -- tests/e2e/partner-onboarding-approval.spec.ts`
- Browser QA coverage should prove:
  - developers can manage signing keys according to role policy
  - owners can update security settings and see the change persist
  - a freshly onboarded owner can satisfy setup prerequisites, request production approval from `/setup`, and cancel the pending request
  - first-user onboarding completion stays functional in the live browser path through the admin `/setup` bootstrap flow
- Phase 41 verification passed after switching the approval flow to a freshly browser-created partner instead of relying on a mutable demo org state, and after generating a real ED25519 public key inside the Playwright signing-key test to satisfy backend PEM validation.

## Phase 40 Scope
- extend browser coverage beyond access/webhook/admin-state mutations into trust-object and production-governance workflows
- cover high-value mutation journeys that are still only verified at the API level:
  - recipient creation and disable
  - destination creation, replacement, and revocation
  - production approval review with scope override
  - corridor grant and revoke follow-up after approval
- keep the suite deterministic by continuing to use unique labels and scoped selectors in dense admin screens

## Phase 40 Backend Changes
- no new backend product surface is required if the current mutation routes remain stable
- reuse the seeded QA orgs and approval fixtures already established in prior phases

## Phase 40 Frontend Changes
- add one or more Playwright suites for trust-object lifecycle and production-governance mutations
- reuse the seeded owner and admin credentials
- assert on flash messaging, table/detail-card transitions, and approval/corridor state changes after each mutation

## Phase 40 Files Expected
- `dashboard/tests/e2e/partner-trust-object-mutations.spec.ts`
- `dashboard/tests/e2e/admin-production-governance.spec.ts`

## Phase 40 Verification
- `backend`: `npm run db:seed`
- `dashboard`: `npm run lint`
- `dashboard`: `npm run build`
- `dashboard`: `npm run test:playwright -- tests/e2e/partner-trust-object-mutations.spec.ts`
- `dashboard`: `npm run test:playwright -- tests/e2e/admin-production-governance.spec.ts`
- Browser QA coverage should prove:
  - owners can create and disable recipients
  - owners can create, replace, and revoke destinations
  - admin reviewers can approve with corridor-scope overrides
  - admins can grant and revoke production corridors after approval
- Phase 40 verification passed after scoping the destinations create form away from the list filters and tightening the admin governance assertions around state transitions instead of label-format differences (`Ether` vs `ETH`).

## Phase 39 Scope
- add a mutation-focused Playwright suite for real dashboard write flows instead of only visibility/state checks
- cover high-value partner-side mutations:
  - API key issuance and revocation
  - team invite creation
  - webhook creation plus endpoint lifecycle actions
- cover high-value admin-side mutations in `/setup`:
  - partner creation
  - partner state updates
- keep the suite deterministic on repeated runs by:
  - using unique labels, emails, URLs, and slugs
  - running the mutation file serially
  - avoiding assertions that depend on ambiguous repeated shell text

## Phase 39 Backend Changes
- no new backend product surface is required if the existing mutation routes are already wired
- reseed existing demo users before the browser run so owner/admin flows start from a known state

## Phase 39 Frontend Changes
- add a new Playwright suite for mutation-heavy partner/admin flows
- reuse the existing owner and admin seeded credentials
- assert on real flash messages, table rows, and state transitions after each mutation

## Phase 39 Files Expected
- `dashboard/tests/e2e/partner-mutation-flows.spec.ts`
- optional seed/doc tracking updates if the suite requires stable extra fixtures

## Phase 39 Verification
- `backend`: `npm run db:seed`
- `dashboard`: `npm run lint`
- `dashboard`: `npm run build`
- `dashboard`: `npm run test:playwright -- tests/e2e/partner-mutation-flows.spec.ts`
- Browser QA coverage should prove:
  - owners can issue and revoke API keys
  - owners can create team invites
  - owners can create webhook endpoints and mutate endpoint state
  - admin setup can create a partner and update partner state
- Phase 39 verification passed after normalizing Playwright to `localhost` so dashboard session cookies survive redirect-based form actions and scoping selectors to the correct webhook/admin forms.

## Phase 38 Scope
- eliminate the backend `pg` deprecation warning:
  - `Calling client.query() when the client is already executing a query is deprecated`
- isolate the warning to the exact e2e suite and request path before patching
- keep the fix focused on backend transaction behavior rather than suppressing warnings globally

## Phase 38 Backend Changes
- trace the warning to `production-approval.e2e-spec.ts`
- identify the production-approval workflow as the source of relation-heavy reads inside Prisma transactions
- refactor production-approval request, cancel, and review flows so the transaction only performs writes and audit events
- move hydrated response reads for production-approval records out of the transaction and back onto the normal Prisma client after commit

## Phase 38 Files Expected
- `backend/src/partners/partners.service.ts`

## Phase 38 Verification
- `backend`: `npm run db:seed`
- `backend`: `NODE_OPTIONS=--trace-deprecation npx jest --config ./test/jest-e2e.json --runInBand test/production-approval.e2e-spec.ts`
- `backend`: `npm run test:e2e -- --runInBand`
- `backend`: `npm run build`
- `backend`: `npm run lint`
- The backend e2e path now runs cleanly without the prior `pg` deprecation warning.

## Phase 37 Scope
- remove the lingering Jest post-run warning from the backend e2e command:
  - `npm run test:e2e -- --runInBand`
- ensure the fix addresses the real plain-test path rather than only making `--detectOpenHandles` pass
- keep the fix small and focused on backend test shutdown semantics

## Phase 37 Backend Changes
- run backend e2e suites under a consistent `NODE_ENV=test` by adding a shared Jest e2e setup file
- tighten the Prisma Postgres adapter configuration in tests so idle database sockets do not keep the Node process alive after shutdown
- keep the app e2e suite deterministic by explicitly disabling the webhook worker in that suite and avoiding repeated per-test app bootstrap assumptions

## Phase 37 Files Expected
- `backend/test/jest-e2e.json`
- `backend/test/setup-e2e.ts`
- `backend/src/prisma/prisma.service.ts`
- `backend/test/app.e2e-spec.ts`

## Phase 37 Verification
- `backend`: `npm run db:seed`
- `backend`: `npm run test:e2e -- --runInBand`
- `backend`: `npm run build`
- `backend`: `npm run lint`
- The backend e2e suite now exits cleanly without the previous Jest open-handle warning.
- Residual note: none for Phase 37; the remaining `pg` warning was addressed in Phase 38.

## Phase 36 Scope
- add stable role-sensitive demo coverage for the existing combined demo organization:
  - owner
  - analyst
  - developer
- seed an always-pending production approval request so the admin `/setup` review queue has deterministic browser coverage
- add a second Playwright browser suite focused on:
  - owner navigation and access-management visibility
  - analyst read-only restrictions
  - developer integration-surface access without org-admin surfaces
  - admin setup workspace review-queue visibility and partner-state controls
- keep the assertions resilient to repeated shell text and shared labels across queue cards, roster rows, and detail panels

## Phase 36 Backend Changes
- extend the seed to add a stable developer user for the combined demo organization with the intended developer dashboard scope bundle
- seed a deterministic pending production-approval request for the consumer demo organization so the admin review queue is never empty during browser QA
- keep all new QA users and fixtures compatible with the existing hidden/demo-partner strategy so the public supported-platform directory remains curated

## Phase 36 Frontend Changes
- add a Playwright role/admin matrix covering:
  - owner access-management navigation
  - analyst hidden key/team/security surfaces
  - developer API-key and signing-key management access
  - admin `/setup` review queue and selected-partner management workflow
- tighten browser assertions around duplicated partner labels in the admin setup workspace so the suite validates the intended card or control instead of colliding on repeated text elsewhere in the page

## Phase 36 Files Expected
- `backend/prisma/seed.ts`
- `dashboard/tests/e2e/partner-role-admin-matrix.spec.ts`

## Phase 36 Verification
- `backend`: `npm run db:seed`
- `dashboard`: `npm run lint`
- `dashboard`: `npm run build`
- `dashboard`: `npm run test:playwright -- tests/e2e/partner-role-admin-matrix.spec.ts`
- Browser QA coverage now proves:
  - owners see full API key, signing key, team, and security navigation
  - analysts stay on read-only partner surfaces without access-management navigation
  - developers can access integration-management surfaces without org-admin pages
  - admin `/setup` shows a live pending approval queue and selected-partner state controls
  - the browser suite stays stable against repeated admin workspace text labels by scoping assertions to the correct cards and controls

## Phase 35 Scope
- add stable demo organizations and partner-user credentials for the missing V3 browser QA states:
  - consumer-only
  - data-only
  - combined production
  - degraded feed-health
  - restricted (no sandbox, no production)
- keep the public platform directory clean while adding those QA organizations:
  - demo state-orgs must not leak into `/v1/platforms`
- add a first Playwright browser matrix for seeded partner-state journeys:
  - consumer-only visibility and registry restrictions
  - data-only registry/feed-health posture
  - combined production readiness visibility
  - degraded feed-health visibility
  - restricted resolution/sandbox behavior
- verify the dashboard against the actual running UI rather than only backend policy tests

## Phase 35 Backend Changes
- extend the seed model to support hidden QA demo organizations without polluting the supported-platform directory
- seed stable partner-user accounts for the new V3 org-state matrix
- keep the existing curated public platforms listed while leaving QA state partners unlisted

## Phase 35 Frontend Changes
- add Playwright config for the dashboard
- add a seeded-org-state browser suite covering the external partner dashboard state matrix
- keep assertions focused on:
  - nav visibility
  - module availability banners
  - readiness and feed-health cards
  - restricted operational-resolution behavior

## Phase 35 Files Expected
- `backend/prisma/seed.ts`
- `dashboard/package.json`
- `dashboard/playwright.config.ts`
- `dashboard/tests/e2e/partner-state-matrix.spec.ts`

## Phase 35 Verification
- `backend`: `npm run db:seed`
- `backend`: `npm run build`
- `dashboard`: `npm run lint`
- `dashboard`: `npm run build`
- `dashboard`: `npm run test:playwright -- tests/e2e/partner-state-matrix.spec.ts`
- Browser QA coverage now proves:
  - consumer-only partners do not get registry navigation and see explicit registry availability messaging
  - data-only partners see registry and data-feed surfaces without sender-side API posture
  - combined production partners surface production-readiness state
  - degraded partners surface degraded feed-health on overview and data-feed-health
  - restricted partners can sign in but cannot run live resolution or access sandbox

## Phase 34 Scope
- tighten remaining V3 capability/state mismatches between backend and dashboard:
  - full-attestation partners should be treated as data-contributing partners wherever the product model expects that
  - restricted partners with neither sandbox nor production enabled must not execute live operational resolution flows
  - batch verification visibility must respect the actual batch capability flag
- align remaining direct-route dashboard pages so they render explicit availability states instead of falling through into backend denials
- extend the backend policy e2e suite to cover:
  - restricted-environment denial for operational resolution
  - restricted-environment denial for supported-platform listing
  - full-attestation-only registry access and profile semantics

## Phase 34 Backend Changes
- extend the partner access policy metadata with an operational-environment requirement that denies route execution when a partner has neither sandbox nor production access enabled
- apply that enforcement to operational resolution execution and platform-listing routes while leaving read-only history surfaces available
- broaden partner access policies so full-attestation partners can use the same read/manage surfaces as data contributors where intended:
  - resolution testing surfaces
  - supported-platform listing
  - partner self-service API credential management
- add e2e coverage proving:
  - restricted partners cannot execute live resolution flows
  - restricted partners cannot list supported platforms
  - full-attestation-only partners can read registry data and expose the correct capability profile

## Phase 34 Frontend Changes
- update shared capability helpers so API key access, registry guidance, and onboarding logic consistently use the same data-contributor abstraction
- align API Keys and Signing Keys page availability states with the backend capability model
- align webhook docs and onboarding checklist logic with the same data-contributor helper
- keep resolution logs visible for state review while requiring sandbox or production access for live execution pages

## Phase 34 Files Expected
- `backend/src/auth/partner-access-policy.decorator.ts`
- `backend/src/auth/partner-api-key-auth.guard.ts`
- `backend/src/resolution/resolution.controller.ts`
- `backend/src/platforms/platforms.controller.ts`
- `backend/src/partners/partner-account.controller.ts`
- `backend/test/partner-policy-enforcement.e2e-spec.ts`
- `dashboard/src/lib/vervet-api.ts`
- `dashboard/src/app/(ops)/access/api-keys/page.tsx`
- `dashboard/src/app/(ops)/access/signing-keys/page.tsx`
- `dashboard/src/app/(ops)/docs/webhooks/page.tsx`
- `dashboard/src/components/partner-onboarding-home.tsx`
- `dashboard/src/lib/partner-guidance.ts`

## Phase 34 Verification
- `backend`: `npm run build`
- `backend`: `npm run lint`
- `backend`: `npm test -- --runInBand`
- `backend`: `npm run test:e2e -- --runInBand`
- `dashboard`: `npm run lint`
- `dashboard`: `npm run build`
- Automated QA focus:
  - restricted partners cannot run operational resolution or list platforms
  - full-attestation-only partners can read registry data and expose `FULL_ATTESTATION_PARTNER`
  - API key and signing-key pages show explicit availability messaging instead of falling through into backend errors
  - batch verification visibility remains capability-aware

## Phase 33 Scope
- expand `GET /v1/data-feed-health` from a thin aggregate into an operational feed-health payload that includes:
  - corridor-level freshness summaries
  - recent attestation ingestion history
  - recent failed ingestion history
  - recent downstream event failure history
  - existing stale-destination and stale-attestation drilldowns
- add durable audit visibility for failed attestation ingestion attempts so feed-health can show real failure history going forward instead of only successful trust updates
- derive corridor health from existing trust objects and production-corridor records:
  - last attestation received per corridor
  - last revocation received per corridor
  - active destination count
  - verified attestation count
  - stale destination count
  - expiring / stale attestation count
  - production-granted indicator
  - corridor health status label
- update the dashboard `Data Feed Health` route so it becomes the primary operational page for:
  - corridor health
  - recent ingestion activity
  - recent failures
  - stale object review
- update shared feed-health UI and the higher-level overview / registry pages so they surface the richer signals:
  - degraded corridor count
  - recent ingestion failure count
  - corridor freshness visibility where useful

## Phase 33 Backend Changes
- keep the existing `GET /v1/data-feed-health` route and expand its response rather than introducing multiple small dashboard-only endpoints
- extend the feed-health service to return:
  - `metrics`
    - existing counts
    - `recentIngestionSuccessCount7d`
    - `recentIngestionFailureCount7d`
    - `degradedCorridorCount`
  - `ingestion`
    - recent ingestion activity records
    - recent ingestion failure records
  - `corridors`
    - corridor freshness / health rows
  - `eventHealth`
    - failed webhook delivery history
    - optional recent webhook test failures from audit data when present
- record `attestation.ingest_failed` audit events on rejected attestation-ingestion attempts with enough metadata to support partner-scoped operational review:
  - partner
  - key id
  - attestation type
  - recipient identifier
  - chain
  - asset
  - sequence number
  - failure reason
- reuse existing audit logs for ingestion history and failure history where possible so the model stays honest to the real product, rather than inventing a fake batch-import concept

## Phase 33 Frontend Changes
- rebuild `/data-feed-health` to add:
  - summary cards for ingestion success/failure and degraded corridors
  - corridor freshness table
  - recent ingestion activity table
  - recent failure history table
  - existing stale-destination and stale-attestation drilldowns
- expand `FeedHealthCard` so it can surface corridor degradation and recent ingestion failures in addition to stale-object counts
- update Overview, Recipients, Destinations, and Attestations to show richer feed-health hints using the expanded payload without turning those pages into full feed-health replicas

## Phase 33 Files Expected
- `backend/src/data-feed-health/data-feed-health.service.ts`
- `backend/src/data-feed-health/data-feed-health.controller.ts`
- `backend/src/attestations/attestations.controller.ts`
- `backend/src/attestations/attestations.service.ts`
- `backend/test/data-feed-health.e2e-spec.ts`
- `backend/test/*.e2e-spec.ts` where feed-health fixtures need to include new fields
- `dashboard/src/lib/vervet-api.ts`
- `dashboard/src/app/(ops)/data-feed-health/page.tsx`
- `dashboard/src/components/feed-health-card.tsx`
- `dashboard/src/app/(ops)/overview/page.tsx`
- `dashboard/src/app/(ops)/recipients/page.tsx`
- `dashboard/src/app/(ops)/destinations/page.tsx`
- `dashboard/src/app/(ops)/attestations/page.tsx`

## Phase 33 Verification
- `backend`: `npm run build`
- `backend`: `npm run lint`
- `backend`: `npm test -- --runInBand`
- `backend`: `npm run test:e2e -- --runInBand`
- `dashboard`: `npm run lint`
- `dashboard`: `npm run build`
- Manual/runtime verification:
  - data partners can open `/data-feed-health` and see corridor health, ingestion activity, and failure history
  - consumer-only partners still see the correct restricted-module state
  - stale destinations and stale attestations remain visible and accurate
  - a failed attestation ingestion attempt produces a partner-scoped failure record that appears in feed-health history

## Phase 32 Scope
- add a metadata-driven policy layer to partner-facing backend routes for:
  - partner capability flags
  - minimum onboarding stage
  - allowed actor types
  - allowed partner-user roles
- apply that policy layer to the routes that are currently only scope-gated or dashboard-gated:
  - resolution and platforms
  - recipients, destinations, and attestations
  - data-feed health
  - webhooks
  - audit exports
  - sensitive partner self-service routes under `/v1/partners/me`
- align the dashboard navigation and access pages with the stricter role-sensitive backend behavior so direct visits do not degrade into backend errors for lower-privilege users
- add e2e coverage for:
  - capability denial
  - onboarding-stage denial
  - batch capability denial
  - role-sensitive access denial

## Locked V3 Decisions
- The external product remains one dashboard: **Vervet Platform Dashboard**.
- There will not be separate external dashboards for API consumers and data partners.
- Dashboard behavior adapts through organization-level capability flags, onboarding stage, and readiness state.
- Existing V2 routes remain the base route map.
- `/setup` now serves two external-facing states without breaking the bootstrap flow:
  - authenticated partner users see the onboarding home and guided checklist
  - unauthenticated/admin-token flows still see the admin bootstrap workspace

## V3 Capability Model
Phase 1 adds organization-level fields and API exposure for these booleans:

- `apiConsumerEnabled`
- `dataPartnerEnabled`
- `fullAttestationPartnerEnabled`
- `webhooksEnabled`
- `batchVerificationEnabled`
- `auditExportsEnabled`
- `sandboxEnabled`
- `productionEnabled`

Phase 1 also adds two organization state fields:

- `onboardingStage`
- `feedHealthStatus`

### Proposed enums
- `PartnerOnboardingStage`
  - `ACCOUNT_CREATED`
  - `API_ACCESS_READY`
  - `TRUST_SETUP_READY`
  - `DATA_MAPPING_IN_PROGRESS`
  - `BOOTSTRAP_IMPORT_COMPLETED`
  - `LIVE_FEED_CONNECTED`
  - `PRODUCTION_APPROVED`
- `PartnerFeedHealthStatus`
  - `UNKNOWN`
  - `HEALTHY`
  - `DEGRADED`
  - `DISCONNECTED`

## Backend Changes

### Schema and data model
- Extend `Partner` with:
  - capability flags listed above
  - `onboardingStage`
  - `feedHealthStatus`
- Set sensible create-time defaults for new partners:
  - `apiConsumerEnabled = true`
  - `dataPartnerEnabled = false`
  - `fullAttestationPartnerEnabled = false`
  - `webhooksEnabled = true`
  - `batchVerificationEnabled = true`
  - `auditExportsEnabled = true`
  - `sandboxEnabled = true`
  - `productionEnabled = false`
  - `onboardingStage = ACCOUNT_CREATED`
  - `feedHealthStatus = UNKNOWN`

### Partner profile API
- Enrich `GET /v1/partners/me` so it returns:
  - existing partner and actor metadata
  - `capabilities`
  - `onboarding`
  - `readiness`
- `onboarding` should include:
  - current stage
  - completed tasks
  - blocked tasks
  - next recommended action
- `readiness` should include:
  - sandbox-only vs production-approved state
  - feed health status
  - a compact production readiness label

### Seed data
- Keep the curated platform directory from Phase 21.
- Add realistic capability/readiness defaults for seeded demo organizations:
  - `ivorypay`: consumer + data partner
  - add at least one consumer-only demo organization
  - add at least one data-partner-weighted demo organization where useful

### Backend files expected in Phase 1
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/*`
- `backend/prisma/seed.ts`
- `backend/src/partners/partners.service.ts`
- `backend/src/partners/partner-account.controller.ts`
- `backend/src/partners/dto/*` if profile response typing is split out
- `backend/test/*.e2e-spec.ts`

## Frontend Changes

### Shell and session context
- Keep the current app shell and route map.
- Fetch enriched partner profile in the operations layout and pass it into the shell.
- Use the enriched partner profile, not only raw scopes, to decide:
  - which nav groups are visible
  - which nav items are hidden
  - which modules show as unavailable

### New shared UI primitives for Phase 1
- `PartnerCapabilityBadge`
- `OnboardingProgressCard`
- `ProductionReadinessCard`
- `ModuleAvailabilityBanner`

### Navigation gating rules
- `Overview`: always visible to authenticated partner users.
- `Resolution`: visible when `apiConsumerEnabled` or `dataPartnerEnabled`.
- `Recipients`, `Destinations`, `Attestations`: visible in nav only when `dataPartnerEnabled`; direct-route access should show an availability banner if the user somehow reaches them.
- `Webhooks`: visible when `webhooksEnabled`.
- `API Keys`: visible when `apiConsumerEnabled` or `dataPartnerEnabled`.
- `Signing Keys`: visible when `dataPartnerEnabled` or `fullAttestationPartnerEnabled`.
- `Team` / `Security`: still scope-gated, but now also supported by partner readiness context in the shell.
- `Audit Exports`: visible only when `auditExportsEnabled`.
- `Sandbox`: visible only when `sandboxEnabled`.

### Overview adaptation
- Add a capability summary block.
- Add onboarding progress summary.
- Add production readiness summary.
- Keep existing operational metrics, but show partner-aware helper copy based on capability profile.

### Restricted-module behavior
- For `Recipients`, `Destinations`, and `Attestations`, add a `ModuleAvailabilityBanner` when:
  - the organization is not data-partner-enabled
  - onboarding has not progressed far enough for the module to be operational
- The banner should explain why the module is unavailable and what the next setup step is.

### Frontend files expected in Phase 1
- `dashboard/src/app/(ops)/layout.tsx`
- `dashboard/src/components/app-shell.tsx`
- `dashboard/src/components/dashboard-nav.tsx`
- `dashboard/src/components/mobile-nav-drawer.tsx`
- `dashboard/src/components/partner-capability-badge.tsx`
- `dashboard/src/components/onboarding-progress-card.tsx`
- `dashboard/src/components/production-readiness-card.tsx`
- `dashboard/src/components/module-availability-banner.tsx`
- `dashboard/src/app/(ops)/overview/page.tsx`
- `dashboard/src/app/(ops)/recipients/page.tsx`
- `dashboard/src/app/(ops)/destinations/page.tsx`
- `dashboard/src/app/(ops)/attestations/page.tsx`
- `dashboard/src/lib/vervet-api.ts`
- `dashboard/src/lib/session.ts`
- `dashboard/src/app/globals.css`

## Route-to-Owner Breakdown for Phase 1

### Shell-owned routes
- `/(ops)/*`
  - owner: Platform Console shell
  - backend dependency: `GET /v1/partners/me`
  - gated by: authenticated session

### Capability-aware routes
- `/overview`
  - owner: platform operations
  - dependency: `GET /v1/overview`, enriched `GET /v1/partners/me`
  - gated by: authenticated session
- `/resolution/*`
  - owner: API consumer + validation flows
  - dependency: existing resolution APIs + enriched `GET /v1/partners/me`
  - gated by: `apiConsumerEnabled || dataPartnerEnabled`
- `/recipients`, `/destinations`, `/attestations`
  - owner: data partner operations
  - dependency: existing registry APIs + enriched `GET /v1/partners/me`
  - gated by: `dataPartnerEnabled` for full access, otherwise show restricted state
- `/webhooks*`
  - owner: integration operations
  - dependency: existing webhook APIs + enriched `GET /v1/partners/me`
  - gated by: `webhooksEnabled`
- `/access/api-keys`
  - owner: integration operations
  - dependency: existing credential APIs + enriched `GET /v1/partners/me`
  - gated by: `apiConsumerEnabled || dataPartnerEnabled`
- `/access/signing-keys`
  - owner: data partner trust setup
  - dependency: existing signing-key APIs + enriched `GET /v1/partners/me`
  - gated by: `dataPartnerEnabled || fullAttestationPartnerEnabled`
- `/audit/exports`
  - owner: compliance ops
  - dependency: existing export APIs + enriched `GET /v1/partners/me`
  - gated by: `auditExportsEnabled`
- `/sandbox`
  - owner: developer experience
  - dependency: existing sandbox/resolution APIs + enriched `GET /v1/partners/me`
  - gated by: `sandboxEnabled`

## Verification Steps
- `backend`: `npm run prisma:validate`
- `backend`: `npm run prisma:generate`
- `backend`: `npm run build`
- `backend`: `npm run lint`
- `backend`: `npm run test:e2e -- --runInBand`
- `dashboard`: `npm run lint`
- `dashboard`: `npm run build`
- Manual verification:
  - an authenticated partner receives `capabilities`, `onboarding`, and `readiness` from `GET /v1/partners/me`
  - shell and mobile drawer hide/show nav groups by capability profile
  - overview renders capability and readiness widgets
  - restricted `Recipients`/`Destinations`/`Attestations` pages show module availability messaging for non-data partners
  - sandbox-only and production-enabled partners show different readiness labels

## Rollback Strategy
- Keep the V2 route structure intact so Phase 1 can be rolled back by:
  - reverting the enriched partner profile fields
  - reverting the dashboard shell gating and capability widgets
- Existing scope-based behavior remains the fallback if capability metadata needs to be disabled.
