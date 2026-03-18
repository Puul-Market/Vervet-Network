import { createHash, createHmac } from 'node:crypto';

export function deriveWebhookSigningSecret(
  endpointId: string,
  signingSecretVersion: number,
  masterSecret: string,
): string {
  return createHmac('sha256', masterSecret)
    .update(`${endpointId}:${signingSecretVersion}`)
    .digest('base64url');
}

export function signWebhookPayload(params: {
  payload: string;
  timestamp: string;
  secret: string;
}): string {
  const signedContent = `${params.timestamp}.${params.payload}`;
  const signature = createHmac('sha256', params.secret)
    .update(signedContent)
    .digest('hex');

  return `v1=${signature}`;
}

export function hashWebhookPayload(payload: string): string {
  return createHash('sha256').update(payload).digest('hex');
}
