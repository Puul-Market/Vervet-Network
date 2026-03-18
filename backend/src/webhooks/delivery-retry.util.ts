const webhookInitialRetryDelayMs = 60_000;
const webhookMaxRetryDelayMs = 30 * 60_000;

export const maxWebhookDeliveryAttempts = 5;

export function calculateNextWebhookAttemptAt(
  baseTime: Date,
  attemptCount: number,
): Date {
  const nextRetryDelayMs = calculateNextWebhookRetryDelayMs(attemptCount);

  return new Date(baseTime.getTime() + nextRetryDelayMs);
}

export function calculateNextWebhookRetryDelayMs(attemptCount: number): number {
  if (!Number.isInteger(attemptCount) || attemptCount < 1) {
    throw new Error('attemptCount must be a positive integer.');
  }

  const exponentialDelayMs =
    webhookInitialRetryDelayMs * 2 ** (attemptCount - 1);

  return Math.min(exponentialDelayMs, webhookMaxRetryDelayMs);
}

export function shouldAbandonWebhookDelivery(attemptCount: number): boolean {
  if (!Number.isInteger(attemptCount) || attemptCount < 1) {
    throw new Error('attemptCount must be a positive integer.');
  }

  return attemptCount >= maxWebhookDeliveryAttempts;
}
