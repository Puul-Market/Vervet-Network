import {
  deriveWebhookSigningSecret,
  hashWebhookPayload,
  signWebhookPayload,
} from './webhook-signing.util';

describe('webhook signing util', () => {
  it('derives deterministic per-endpoint secrets', () => {
    expect(deriveWebhookSigningSecret('endpoint-123', 1, 'master-secret')).toBe(
      deriveWebhookSigningSecret('endpoint-123', 1, 'master-secret'),
    );
  });

  it('changes the secret when the version changes', () => {
    expect(
      deriveWebhookSigningSecret('endpoint-123', 1, 'master-secret'),
    ).not.toBe(deriveWebhookSigningSecret('endpoint-123', 2, 'master-secret'));
  });

  it('signs payloads with versioned hmac output', () => {
    const signature = signWebhookPayload({
      payload: '{"ok":true}',
      timestamp: '2026-03-11T00:00:00.000Z',
      secret: 'webhook-secret',
    });

    expect(signature.startsWith('v1=')).toBe(true);
    expect(hashWebhookPayload('{"ok":true}')).toHaveLength(64);
  });
});
