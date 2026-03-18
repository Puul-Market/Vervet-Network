import {
  calculateNextWebhookAttemptAt,
  calculateNextWebhookRetryDelayMs,
  maxWebhookDeliveryAttempts,
  shouldAbandonWebhookDelivery,
} from './delivery-retry.util';

describe('delivery retry util', () => {
  it('calculates exponential retry delays with a ceiling', () => {
    expect(calculateNextWebhookRetryDelayMs(1)).toBe(60_000);
    expect(calculateNextWebhookRetryDelayMs(2)).toBe(120_000);
    expect(calculateNextWebhookRetryDelayMs(5)).toBe(960_000);
    expect(calculateNextWebhookRetryDelayMs(8)).toBe(1_800_000);
  });

  it('calculates the next attempt timestamp from a base time', () => {
    const baseTime = new Date('2026-03-11T10:00:00.000Z');

    expect(calculateNextWebhookAttemptAt(baseTime, 3).toISOString()).toBe(
      '2026-03-11T10:04:00.000Z',
    );
  });

  it('abandons deliveries at the configured attempt limit', () => {
    expect(shouldAbandonWebhookDelivery(maxWebhookDeliveryAttempts - 1)).toBe(
      false,
    );
    expect(shouldAbandonWebhookDelivery(maxWebhookDeliveryAttempts)).toBe(true);
  });
});
