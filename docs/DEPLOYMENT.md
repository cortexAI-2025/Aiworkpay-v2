# Deployment and acceptance

Deploy the application branch containing the agent API, not the old default branch.
Docker startup applies `prisma migrate deploy` before starting Next.js.

Required application variables:
- `DATABASE_URL`: persistent PostgreSQL database.
- `AUTH_SECRET`: random secret; `AUTH_URL` and `NEXT_PUBLIC_APP_URL`: deployed HTTPS origin.
- `ADMIN_EMAILS`: administrator email(s) allowed to activate access.
- `ADMIN_SETUP_TOKEN`: random activation code, entered in My Account after signup; remove it after activation. Public signup never grants admin based on email alone.
- `STRIPE_SECRET_KEY`: restricted test key for acceptance, with required Connect permissions.
- `STRIPE_WEBHOOK_SECRET`: signing secret of this application's webhook endpoint.
- `CLAMAV_HOST`: private address of a running clamd service (port 3310).
- `STORAGE_DRIVER=s3` and S3 variables from `.env.example`, with a private bucket;
  alternatively persistent volume at `UPLOAD_DIR` with local storage.

Webhook URL: `/api/stripe/webhooks`. Subscribe to `payment_intent.succeeded`,
`payment_intent.payment_failed`, `checkout.session.expired`, `transfer.created`.
Never disable antivirus in production. Do not share test and live databases.

New API keys default to read/write. `missions:approve` explicitly authorizes
an agent to approve a result and trigger the irreversible Connect transfer.
Without this scope an administrator approves through the dashboard.
Existing keys keep their previous permissions; review and revoke/reissue them as needed.

Acceptance on Stripe test mode:
1. Sign up an administrator and a Payworker; complete test Connect onboarding.
2. Create a bounded agent key; connect the MCP with the deployed application URL.
3. Create a mission, pay Checkout with a test payment method, verify publication.
4. Accept/start as Payworker, upload a clean photo, deliver a structured result.
5. Read result and photo through MCP; approve via authorized agent or administrator.
6. Verify the payout ledger and Stripe transfer, including pending/failed recovery.
7. Repeat approval: no second ledger entry or transfer. Cancel another open mission
   and verify refund. Verify a second agent cannot read the first agent's mission.
8. Verify antivirus failure rejects upload without storing the file.

A pending payout can be retried by an authenticated administrator with same-origin
`POST /api/missions/{id}/retry-payout`. It reuses the original Stripe idempotency key.
A succeeded transfer to a Connect account is not a bank payout confirmation.

Run `npm run check`, `npm test`, `npm run build` before publishing.
