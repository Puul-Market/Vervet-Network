const e2eSharedMasterSecret = 'test-webhook-signing-secret';

process.env.NODE_ENV = 'test';
process.env.WEBHOOK_SIGNING_MASTER_SECRET = e2eSharedMasterSecret;
process.env.ENCRYPTED_SUBMISSION_MASTER_SECRET = e2eSharedMasterSecret;
