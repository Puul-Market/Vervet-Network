import {
  type AttestationType,
  type IdentifierKind,
  SigningKeyAlgorithm,
  type TokenStandard,
} from '@prisma/client';
import { createHash, createPublicKey, verify } from 'node:crypto';
import { CreateAttestationDto } from './dto/create-attestation.dto';

export interface CanonicalAttestationInput {
  partnerSlug: string;
  keyId: string;
  algorithm: SigningKeyAlgorithm;
  attestationType: AttestationType;
  sequenceNumber: number;
  recipientExternalId: string;
  recipientDisplayName: string;
  recipientIdentifier: string;
  identifierKind: IdentifierKind;
  chain: string;
  assetCode: string;
  assetSymbol: string;
  tokenStandard: TokenStandard;
  contractAddress: string;
  decimals: number | null;
  address: string;
  memo: string;
  issuedAt: string;
  effectiveFrom: string;
  expiresAt: string | null;
}

export function buildCanonicalAttestationInput(
  createAttestationDto: CreateAttestationDto,
  normalizedFields: {
    partnerSlug: string;
    recipientIdentifier: string;
    chain: string;
    assetCode: string;
    assetSymbol: string;
    contractAddress: string;
    address: string;
    memo: string;
  },
): CanonicalAttestationInput {
  return {
    partnerSlug: normalizedFields.partnerSlug,
    keyId: createAttestationDto.keyId.trim(),
    algorithm: createAttestationDto.algorithm,
    attestationType: createAttestationDto.attestationType,
    sequenceNumber: createAttestationDto.sequenceNumber,
    recipientExternalId: createAttestationDto.recipientExternalId.trim(),
    recipientDisplayName:
      createAttestationDto.recipientDisplayName?.trim() ?? '',
    recipientIdentifier: normalizedFields.recipientIdentifier,
    identifierKind: createAttestationDto.identifierKind,
    chain: normalizedFields.chain,
    assetCode: normalizedFields.assetCode,
    assetSymbol: normalizedFields.assetSymbol,
    tokenStandard: createAttestationDto.tokenStandard,
    contractAddress: normalizedFields.contractAddress,
    decimals:
      createAttestationDto.decimals === undefined
        ? null
        : createAttestationDto.decimals,
    address: normalizedFields.address,
    memo: normalizedFields.memo,
    issuedAt: new Date(createAttestationDto.issuedAt).toISOString(),
    effectiveFrom: new Date(createAttestationDto.effectiveFrom).toISOString(),
    expiresAt: createAttestationDto.expiresAt
      ? new Date(createAttestationDto.expiresAt).toISOString()
      : null,
  };
}

export function serializeAttestationPayload(
  payload: CanonicalAttestationInput,
): string {
  return JSON.stringify(payload);
}

export function hashAttestationPayload(payload: string): string {
  return createHash('sha256').update(payload).digest('hex');
}

export function verifyAttestationSignature(
  algorithm: SigningKeyAlgorithm,
  publicKeyPem: string,
  payload: string,
  signature: string,
): boolean {
  if (algorithm !== SigningKeyAlgorithm.ED25519) {
    return false;
  }

  return verify(
    null,
    Buffer.from(payload, 'utf8'),
    createPublicKey(publicKeyPem),
    Buffer.from(signature, 'base64'),
  );
}
