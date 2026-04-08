import {
  isSealedValue,
  openSealedString,
  sealString,
} from './sealed-data.util';

describe('sealed-data util', () => {
  it('round-trips sealed values', () => {
    const sealedValue = sealString('audit export payload', 'test-secret');

    expect(isSealedValue(sealedValue)).toBe(true);
    expect(openSealedString(sealedValue, 'test-secret')).toBe(
      'audit export payload',
    );
  });

  it('returns plaintext values unchanged for backward compatibility', () => {
    expect(openSealedString('legacy-plaintext', 'test-secret')).toBe(
      'legacy-plaintext',
    );
  });

  it('rejects tampered sealed values', () => {
    const sealedValue = sealString('audit export payload', 'test-secret');
    const tamperedValue = `${sealedValue}tampered`;

    expect(() => openSealedString(tamperedValue, 'test-secret')).toThrow();
  });
});
