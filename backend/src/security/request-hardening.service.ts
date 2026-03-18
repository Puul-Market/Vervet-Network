import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, QueryType, RiskLevel, RiskSignalKind } from '@prisma/client';
import type { AuthenticatedPartner } from '../auth/authenticated-partner.interface';
import type { EnvironmentVariables } from '../config/environment';
import { PrismaService } from '../prisma/prisma.service';

export type ResolutionLookupDecision =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      reason: 'rate_limit' | 'enumeration';
      riskLevel: RiskLevel;
      flags: RiskSignalKind[];
      recommendation: string;
      metadata: Prisma.InputJsonObject;
    };

@Injectable()
export class RequestHardeningService {
  private readonly attestationRequestMaxAgeMs: number;
  private readonly attestationRequestNonceTtlMs: number;
  private readonly resolutionLookupRateLimitWindowMs: number;
  private readonly resolutionLookupRateLimitMaxRequests: number;
  private readonly resolutionLookupEnumerationWindowMs: number;
  private readonly resolutionLookupEnumerationMaxIdentifiers: number;

  constructor(
    private readonly prismaService: PrismaService,
    configService: ConfigService<EnvironmentVariables, true>,
  ) {
    this.attestationRequestMaxAgeMs = configService.getOrThrow(
      'ATTESTATION_REQUEST_MAX_AGE_MS',
      { infer: true },
    );
    this.attestationRequestNonceTtlMs = configService.getOrThrow(
      'ATTESTATION_REQUEST_NONCE_TTL_MS',
      { infer: true },
    );
    this.resolutionLookupRateLimitWindowMs = configService.getOrThrow(
      'RESOLUTION_LOOKUP_RATE_LIMIT_WINDOW_MS',
      { infer: true },
    );
    this.resolutionLookupRateLimitMaxRequests = configService.getOrThrow(
      'RESOLUTION_LOOKUP_RATE_LIMIT_MAX_REQUESTS',
      { infer: true },
    );
    this.resolutionLookupEnumerationWindowMs = configService.getOrThrow(
      'RESOLUTION_LOOKUP_ENUMERATION_WINDOW_MS',
      { infer: true },
    );
    this.resolutionLookupEnumerationMaxIdentifiers = configService.getOrThrow(
      'RESOLUTION_LOOKUP_ENUMERATION_MAX_IDENTIFIERS',
      { infer: true },
    );
  }

  async assertAttestationReplayProtection(params: {
    authenticatedPartner: AuthenticatedPartner;
    requestNonce: string | undefined;
    requestTimestamp: string | undefined;
    requestHash: string;
  }) {
    const nonce = this.parseRequestNonce(params.requestNonce);
    const timestamp = this.parseRequestTimestamp(params.requestTimestamp);
    const now = Date.now();
    const credentialId = params.authenticatedPartner.credentialId;

    if (!credentialId) {
      throw new BadRequestException(
        'Attestation replay protection requires an API credential.',
      );
    }

    if (Math.abs(now - timestamp.getTime()) > this.attestationRequestMaxAgeMs) {
      throw new BadRequestException(
        'Request timestamp is outside the accepted freshness window.',
      );
    }

    try {
      await this.prismaService.partnerRequestNonce.create({
        data: {
          credentialId,
          nonce,
          requestHash: params.requestHash,
          expiresAt: new Date(now + this.attestationRequestNonceTtlMs),
        },
      });
    } catch (error: unknown) {
      if (!this.isUniqueConstraintError(error)) {
        throw error;
      }

      const existingRequestNonce =
        await this.prismaService.partnerRequestNonce.findUnique({
          where: {
            credentialId_nonce: {
              credentialId,
              nonce,
            },
          },
        });

      if (!existingRequestNonce) {
        throw new ConflictException(
          'Request nonce was already used and could not be replay-protected safely.',
        );
      }

      if (existingRequestNonce.requestHash !== params.requestHash) {
        throw new ConflictException(
          'Request nonce was already used for a different attestation payload.',
        );
      }

      throw new ConflictException('Request nonce was already used.');
    }
  }

  async evaluateResolutionLookup(params: {
    partnerId: string;
    queryType: QueryType;
    recipientIdentifierNormalized?: string | null;
    providedAddressNormalized?: string | null;
  }): Promise<ResolutionLookupDecision> {
    const now = new Date();
    const rateWindowStart = new Date(
      now.getTime() - this.resolutionLookupRateLimitWindowMs,
    );
    const requestCount = await this.prismaService.resolutionRequest.count({
      where: {
        requesterPartnerId: params.partnerId,
        requestedAt: {
          gte: rateWindowStart,
        },
      },
    });

    if (requestCount >= this.resolutionLookupRateLimitMaxRequests) {
      return {
        allowed: false,
        reason: 'rate_limit',
        riskLevel: RiskLevel.HIGH,
        flags: [],
        recommendation: 'retry_later',
        metadata: {
          control: 'rate_limit',
          requestCount,
          windowMs: this.resolutionLookupRateLimitWindowMs,
          maxRequests: this.resolutionLookupRateLimitMaxRequests,
        },
      };
    }

    const enumerationWindowStart = new Date(
      now.getTime() - this.resolutionLookupEnumerationWindowMs,
    );
    const distinctLookupKey = this.buildDistinctLookupKey(params);

    const recentLookups = await this.prismaService.resolutionRequest.findMany({
      where: {
        requesterPartnerId: params.partnerId,
        requestedAt: {
          gte: enumerationWindowStart,
        },
      },
      select: {
        recipientIdentifierNormalized: true,
        providedAddressNormalized: true,
      },
      take: this.resolutionLookupEnumerationMaxIdentifiers + 10,
    });

    const recentLookupKeys = recentLookups
      .map((request) =>
        this.buildDistinctLookupKey({
          queryType:
            request.providedAddressNormalized &&
            !request.recipientIdentifierNormalized
              ? QueryType.CONFIRM_ADDRESS
              : QueryType.RESOLVE,
          recipientIdentifierNormalized: request.recipientIdentifierNormalized,
          providedAddressNormalized: request.providedAddressNormalized,
        }),
      )
      .filter((key): key is string => key !== null);

    if (recentLookupKeys.includes(distinctLookupKey)) {
      return {
        allowed: true,
      };
    }

    const distinctIdentifiers = new Set(recentLookupKeys);

    if (
      distinctIdentifiers.size >= this.resolutionLookupEnumerationMaxIdentifiers
    ) {
      return {
        allowed: false,
        reason: 'enumeration',
        riskLevel: RiskLevel.CRITICAL,
        flags: [RiskSignalKind.ENUMERATION_SUSPECTED],
        recommendation: 'retry_later',
        metadata: {
          control: 'anti_enumeration',
          distinctIdentifiers: distinctIdentifiers.size,
          windowMs: this.resolutionLookupEnumerationWindowMs,
          maxDistinctIdentifiers:
            this.resolutionLookupEnumerationMaxIdentifiers,
        },
      };
    }

    return {
      allowed: true,
    };
  }

  async cleanupExpiredRequestNonces(): Promise<number> {
    const deletedNonces =
      await this.prismaService.partnerRequestNonce.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

    return deletedNonces.count;
  }

  private parseRequestNonce(value: string | undefined): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException('Missing X-Request-Nonce header.');
    }

    const nonce = value.trim();

    if (nonce.length > 200) {
      throw new BadRequestException('X-Request-Nonce is too long.');
    }

    return nonce;
  }

  private parseRequestTimestamp(value: string | undefined): Date {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException('Missing X-Request-Timestamp header.');
    }

    const rawValue = value.trim();
    const numericValue = Number(rawValue);
    const parsedDate = Number.isFinite(numericValue)
      ? new Date(numericValue)
      : new Date(rawValue);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException('X-Request-Timestamp is invalid.');
    }

    return parsedDate;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private buildDistinctLookupKey(params: {
    queryType: QueryType;
    recipientIdentifierNormalized?: string | null;
    providedAddressNormalized?: string | null;
  }): string {
    if (params.queryType === QueryType.CONFIRM_ADDRESS) {
      const normalizedAddress = params.providedAddressNormalized?.trim();

      if (!normalizedAddress) {
        throw new BadRequestException(
          'Address-based lookups require a normalized address.',
        );
      }

      return `address:${normalizedAddress}`;
    }

    const normalizedIdentifier = params.recipientIdentifierNormalized?.trim();

    if (!normalizedIdentifier) {
      throw new BadRequestException(
        'Recipient-based lookups require a normalized identifier.',
      );
    }

    return `recipient:${normalizedIdentifier}`;
  }
}
