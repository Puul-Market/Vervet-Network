import {
  AttestationType,
  IdentifierKind,
  SigningKeyAlgorithm,
  TokenStandard,
} from '@prisma/client';
import { generateKeyPairSync, sign } from 'node:crypto';
import {
  buildCanonicalAttestationInput,
  hashAttestationPayload,
  serializeAttestationPayload,
  verifyAttestationSignature,
} from './attestation-payload';

describe('attestation payload', () => {
  it('builds a deterministic payload and verifies an ed25519 signature', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const payload = serializeAttestationPayload(
      buildCanonicalAttestationInput(
        {
          partnerSlug: 'bybit',
          keyId: 'primary-key',
          algorithm: SigningKeyAlgorithm.ED25519,
          attestationType: AttestationType.DESTINATION_ASSIGNMENT,
          sequenceNumber: 1,
          recipientExternalId: 'user-123',
          recipientDisplayName: 'Jane A.',
          recipientIdentifier: 'jane@bybit',
          identifierKind: IdentifierKind.PARTNER_HANDLE,
          chain: 'ethereum',
          assetCode: 'usdc',
          assetSymbol: 'USDC',
          tokenStandard: TokenStandard.ERC20,
          contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          decimals: 6,
          address: '0x8ba1f109551bd432803012645ac136ddd64dba72',
          memo: '',
          issuedAt: '2026-03-11T00:00:00.000Z',
          effectiveFrom: '2026-03-11T00:00:00.000Z',
          expiresAt: '2026-06-11T00:00:00.000Z',
          signature: '',
        },
        {
          partnerSlug: 'bybit',
          recipientIdentifier: 'jane@bybit',
          chain: 'ethereum',
          assetCode: 'usdc',
          assetSymbol: 'USDC',
          contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          address: '0x8ba1f109551bd432803012645ac136ddd64dba72',
          memo: '',
        },
      ),
    );
    const signature = sign(
      null,
      Buffer.from(payload, 'utf8'),
      privateKey,
    ).toString('base64');

    expect(hashAttestationPayload(payload)).toHaveLength(64);
    expect(
      verifyAttestationSignature(
        SigningKeyAlgorithm.ED25519,
        publicKey.export({ format: 'pem', type: 'spki' }).toString(),
        payload,
        signature,
      ),
    ).toBe(true);
  });
});
