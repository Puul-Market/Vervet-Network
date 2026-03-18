import {
  defaultCredentialScopes,
  extractApiCredentialPrefix,
  generateApiCredential,
  normalizeCredentialScopes,
  verifyApiCredentialSecret,
} from './api-credential.util';

describe('api credential util', () => {
  it('generates a verifiable credential secret', async () => {
    const generatedCredential = generateApiCredential();

    expect(generatedCredential.keyPrefix.startsWith('vpk_')).toBe(true);
    expect(
      generatedCredential.secret.startsWith(generatedCredential.keyPrefix),
    ).toBe(true);
    await expect(
      verifyApiCredentialSecret(
        generatedCredential.secret,
        generatedCredential.secretHash,
      ),
    ).resolves.toBe(true);
  });

  it('extracts the prefix from a credential secret', () => {
    const generatedCredential = generateApiCredential();

    expect(extractApiCredentialPrefix(generatedCredential.secret)).toBe(
      generatedCredential.keyPrefix,
    );
  });

  it('normalizes and deduplicates scopes', () => {
    expect(
      normalizeCredentialScopes([
        'partners:write',
        ...defaultCredentialScopes,
        'attestations:write',
        'resolution:read',
        'webhooks:read',
        'audit:read',
        'unsupported-scope',
      ]),
    ).toEqual([
      'attestations:write',
      'audit:read',
      'partners:write',
      'resolution:read',
      'webhooks:read',
    ]);
  });
});
