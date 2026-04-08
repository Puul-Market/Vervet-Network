import { createHmac } from 'node:crypto';

export function buildBlindIndex(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value, 'utf8').digest('base64url');
}
