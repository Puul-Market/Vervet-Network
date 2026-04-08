import { buildBlindIndex } from './blind-index.util';

describe('buildBlindIndex', () => {
  it('returns the same blind index for the same value and secret', () => {
    const first = buildBlindIndex('merchant@vervet', 'phase50-secret');
    const second = buildBlindIndex('merchant@vervet', 'phase50-secret');

    expect(first).toBe(second);
  });

  it('changes when the input changes', () => {
    const first = buildBlindIndex('merchant@vervet', 'phase50-secret');
    const second = buildBlindIndex('merchant-2@vervet', 'phase50-secret');

    expect(first).not.toBe(second);
  });

  it('changes when the secret changes', () => {
    const first = buildBlindIndex('merchant@vervet', 'phase50-secret');
    const second = buildBlindIndex('merchant@vervet', 'phase50-secret-2');

    expect(first).not.toBe(second);
  });
});
