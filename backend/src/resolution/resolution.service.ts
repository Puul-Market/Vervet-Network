import { createHash } from 'node:crypto';
import {
  ConflictException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditActorType,
  DestinationStatus,
  PartnerStatus,
  Prisma,
  QueryType,
  RecipientStatus,
  ResolutionBatchInputFormat,
  ResolutionOutcome,
  RiskLevel,
  RiskSignalKind,
  VerificationStatus,
} from '@prisma/client';
import type { AuthenticatedPartner } from '../auth/authenticated-partner.interface';
import { AuditService } from '../audit/audit.service';
import { NormalizationService } from '../common/normalization/normalization.service';
import type { EnvironmentVariables } from '../config/environment';
import { PrismaService } from '../prisma/prisma.service';
import { RecipientsService } from '../recipients/recipients.service';
import {
  RequestHardeningService,
  type ResolutionLookupDecision,
} from '../security/request-hardening.service';
import { BatchVerifyDto } from './dto/batch-verify.dto';
import { ConfirmRecipientDto } from './dto/confirm-recipient.dto';
import { ListResolutionLogsDto } from './dto/list-resolution-logs.dto';
import { ResolveRecipientDto } from './dto/resolve-recipient.dto';
import { VerifyDestinationDto } from './dto/verify-destination.dto';

type DisclosureMode = 'FULL_LABEL' | 'MASKED_LABEL' | 'VERIFICATION_ONLY';
type LookupDirection =
  | 'FORWARD_LOOKUP'
  | 'REVERSE_LOOKUP'
  | 'TRANSFER_VERIFICATION';
type BatchLookupMode = 'BY_RECIPIENT' | 'BY_ADDRESS' | 'MIXED';
type BatchRowLookupMode = Exclude<BatchLookupMode, 'MIXED'>;

interface CandidatePlatform extends Prisma.JsonObject {
  id: string;
  slug: string;
  displayName: string;
}

interface LookupResult {
  outcome: ResolutionOutcome;
  riskLevel: RiskLevel;
  recommendation: string;
  flags: RiskSignalKind[];
  recipientDisplayName?: string | null;
  platform?: string | null;
  address?: string;
  chain?: string;
  asset?: string;
  verified: boolean;
  expiresAt?: string | null;
  recipientId?: string;
  identifierId?: string;
  destinationId?: string;
  attestationId?: string;
  disclosureMode?: DisclosureMode;
  candidatePlatforms?: CandidatePlatform[];
  requiresPlatformSelection?: boolean;
}

interface NormalizedLookupInput {
  recipientIdentifierInput: string;
  recipientIdentifierNormalized: string;
  chainInput: string;
  chainNormalized: string;
  assetInput: string;
  assetCodeNormalized: string;
  assetSymbolNormalized: string;
}

interface NormalizedConfirmInput {
  platformInput: string | null;
  platformNormalized: string | null;
  chainInput: string;
  chainNormalized: string;
  assetInput: string;
  assetCodeNormalized: string;
  assetSymbolNormalized: string;
  addressInput: string;
  addressNormalized: string;
}

interface ResolutionRequestContext {
  authenticatedPartner: AuthenticatedPartner;
  idempotencyKey: string | null;
}

export interface ResolveResponse extends Record<string, Prisma.JsonValue> {
  lookupDirection: LookupDirection;
  disclosureMode: DisclosureMode;
  recipientDisplayName: string | null;
  platform: string | null;
  address: string | null;
  chain: string | null;
  asset: string | null;
  verified: boolean;
  expiresAt: string | null;
  riskLevel: RiskLevel;
  flags: RiskSignalKind[];
  recommendation: string;
}

export interface ConfirmResponse extends Record<string, Prisma.JsonValue> {
  lookupDirection: LookupDirection;
  disclosureMode: DisclosureMode;
  confirmed: boolean;
  verified: boolean;
  recipientDisplayName: string | null;
  platform: string | null;
  chain: string | null;
  asset: string | null;
  expiresAt: string | null;
  riskLevel: RiskLevel;
  flags: RiskSignalKind[];
  recommendation: string;
  candidatePlatforms: CandidatePlatform[];
  requiresPlatformSelection: boolean;
}

export interface VerifyResponse extends Record<string, Prisma.JsonValue> {
  lookupDirection: LookupDirection;
  disclosureMode: DisclosureMode;
  match: boolean;
  verified: boolean;
  recipientDisplayName: string | null;
  platform: string | null;
  riskLevel: RiskLevel;
  flags: RiskSignalKind[];
  recommendation: string;
}

export interface BatchVerifyRowResponse extends Record<
  string,
  Prisma.JsonValue
> {
  clientReference: string | null;
  lookupMode: BatchRowLookupMode;
  platform: string | null;
  recipientIdentifier: string | null;
  submittedAddress: string;
  match: boolean;
  verified: boolean;
  recipientDisplayName: string | null;
  disclosureMode: DisclosureMode | null;
  riskLevel: RiskLevel;
  flags: RiskSignalKind[];
  recommendation: string;
}

export interface BatchVerifyResponse extends Record<string, Prisma.JsonValue> {
  batchRunId: string;
  inputFormat: ResolutionBatchInputFormat;
  lookupMode: BatchLookupMode;
  chain: string;
  asset: string;
  totalRows: number;
  verifiedRows: number;
  warningRows: number;
  blockedRows: number;
  unsupportedRows: number;
  rows: BatchVerifyRowResponse[];
}

const riskLevelValues = new Set<string>(Object.values(RiskLevel));
const riskSignalKindValues = new Set<string>(Object.values(RiskSignalKind));
const resolutionLookupThrottledMessage =
  'Resolution lookup temporarily throttled.';

@Injectable()
export class ResolutionService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly recipientsService: RecipientsService,
    private readonly normalizationService: NormalizationService,
    private readonly auditService: AuditService,
    private readonly requestHardeningService: RequestHardeningService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  async resolve(
    resolveRecipientDto: ResolveRecipientDto,
    requestContext: ResolutionRequestContext,
  ): Promise<ResolveResponse> {
    const lookupInput = this.normalizeLookupInput(
      resolveRecipientDto.recipientIdentifier,
      resolveRecipientDto.chain,
      resolveRecipientDto.asset,
    );
    const requestFingerprint = this.buildRequestFingerprint({
      queryType: QueryType.RESOLVE,
      platformNormalized: null,
      recipientIdentifierNormalized: lookupInput.recipientIdentifierNormalized,
      chainNormalized: lookupInput.chainNormalized,
      assetCodeNormalized: lookupInput.assetCodeNormalized,
      assetSymbolNormalized: lookupInput.assetSymbolNormalized,
      providedAddressNormalized: null,
    });
    const idempotentResponse = await this.getStoredResolveResponse({
      partnerId: requestContext.authenticatedPartner.partnerId,
      idempotencyKey: requestContext.idempotencyKey,
      requestFingerprint,
    });

    if (idempotentResponse) {
      return idempotentResponse;
    }

    const lookupDecision =
      await this.requestHardeningService.evaluateResolutionLookup({
        partnerId: requestContext.authenticatedPartner.partnerId,
        queryType: QueryType.RESOLVE,
        recipientIdentifierNormalized:
          lookupInput.recipientIdentifierNormalized,
      });

    if (!lookupDecision.allowed) {
      await this.blockResolutionLookup({
        authenticatedPartner: requestContext.authenticatedPartner,
        queryType: QueryType.RESOLVE,
        recipientIdentifier: lookupInput.recipientIdentifierInput,
        recipientIdentifierNormalized:
          lookupInput.recipientIdentifierNormalized,
        platformInput: null,
        chainInput: lookupInput.chainInput,
        assetInput: lookupInput.assetInput,
        providedAddressRaw: null,
        providedAddressNormalized: null,
        lookupDecision,
      });
    }

    const lookup = await this.lookupVerifiedDestination(lookupInput);
    const response: ResolveResponse = {
      lookupDirection: 'FORWARD_LOOKUP',
      disclosureMode: lookup.disclosureMode ?? 'FULL_LABEL',
      recipientDisplayName: lookup.recipientDisplayName ?? null,
      platform: lookup.platform ?? null,
      address: lookup.address ?? null,
      chain: lookup.chain ?? null,
      asset: lookup.asset ?? null,
      verified: lookup.verified,
      expiresAt: lookup.expiresAt ?? null,
      riskLevel: lookup.riskLevel,
      flags: lookup.flags,
      recommendation: lookup.recommendation,
    };

    try {
      await this.recordResolutionRequest({
        queryType: QueryType.RESOLVE,
        requesterPartnerId: requestContext.authenticatedPartner.partnerId,
        recipientIdentifier: lookupInput.recipientIdentifierInput,
        recipientIdentifierNormalized:
          lookupInput.recipientIdentifierNormalized,
        platformInput: null,
        chainInput: lookupInput.chainInput,
        assetInput: lookupInput.assetInput,
        address: null,
        normalizedAddress: null,
        idempotencyKey: requestContext.idempotencyKey,
        requestFingerprint,
        responseData: response,
        metadata: {
          lookupDirection: response.lookupDirection,
          disclosureMode: response.disclosureMode,
          platform: response.platform,
        },
        lookup,
      });
    } catch (error: unknown) {
      const concurrentIdempotentResponse = await this.getStoredResolveResponse({
        partnerId: requestContext.authenticatedPartner.partnerId,
        idempotencyKey: requestContext.idempotencyKey,
        requestFingerprint,
      });

      if (concurrentIdempotentResponse && this.isUniqueConstraintError(error)) {
        return concurrentIdempotentResponse;
      }

      throw error;
    }

    return response;
  }

  async confirmAddress(
    confirmRecipientDto: ConfirmRecipientDto,
    requestContext: ResolutionRequestContext,
  ): Promise<ConfirmResponse> {
    const lookupInput = this.normalizeConfirmInput(confirmRecipientDto);
    const requestFingerprint = this.buildRequestFingerprint({
      queryType: QueryType.CONFIRM_ADDRESS,
      platformNormalized: lookupInput.platformNormalized,
      recipientIdentifierNormalized: '',
      chainNormalized: lookupInput.chainNormalized,
      assetCodeNormalized: lookupInput.assetCodeNormalized,
      assetSymbolNormalized: lookupInput.assetSymbolNormalized,
      providedAddressNormalized: lookupInput.addressNormalized,
    });
    const idempotentResponse = await this.getStoredConfirmResponse({
      partnerId: requestContext.authenticatedPartner.partnerId,
      idempotencyKey: requestContext.idempotencyKey,
      requestFingerprint,
    });

    if (idempotentResponse) {
      return idempotentResponse;
    }

    const lookupDecision =
      await this.requestHardeningService.evaluateResolutionLookup({
        partnerId: requestContext.authenticatedPartner.partnerId,
        queryType: QueryType.CONFIRM_ADDRESS,
        providedAddressNormalized: lookupInput.addressNormalized,
      });

    if (!lookupDecision.allowed) {
      await this.blockResolutionLookup({
        authenticatedPartner: requestContext.authenticatedPartner,
        queryType: QueryType.CONFIRM_ADDRESS,
        recipientIdentifier:
          lookupInput.platformInput ?? 'Address-first lookup',
        recipientIdentifierNormalized: '',
        platformInput: lookupInput.platformInput,
        chainInput: lookupInput.chainInput,
        assetInput: lookupInput.assetInput,
        providedAddressRaw: lookupInput.addressInput,
        providedAddressNormalized: lookupInput.addressNormalized,
        lookupDecision,
      });
    }

    const lookup = await this.lookupRecipientConfirmation(lookupInput);
    const response: ConfirmResponse = {
      lookupDirection: 'REVERSE_LOOKUP',
      disclosureMode: lookup.disclosureMode ?? 'VERIFICATION_ONLY',
      confirmed: lookup.verified,
      verified: lookup.verified,
      recipientDisplayName: lookup.recipientDisplayName ?? null,
      platform: lookup.platform ?? null,
      chain: lookup.chain ?? null,
      asset: lookup.asset ?? null,
      expiresAt: lookup.expiresAt ?? null,
      riskLevel: lookup.riskLevel,
      flags: lookup.flags,
      recommendation: lookup.recommendation,
      candidatePlatforms: lookup.candidatePlatforms ?? [],
      requiresPlatformSelection: lookup.requiresPlatformSelection ?? false,
    };

    try {
      await this.recordResolutionRequest({
        queryType: QueryType.CONFIRM_ADDRESS,
        requesterPartnerId: requestContext.authenticatedPartner.partnerId,
        recipientIdentifier:
          lookup.recipientDisplayName ??
          lookupInput.platformInput ??
          'Address-first lookup',
        recipientIdentifierNormalized: '',
        platformInput: lookupInput.platformInput,
        chainInput: lookupInput.chainInput,
        assetInput: lookupInput.assetInput,
        address: lookupInput.addressInput,
        normalizedAddress: lookupInput.addressNormalized,
        idempotencyKey: requestContext.idempotencyKey,
        requestFingerprint,
        responseData: response,
        metadata: {
          lookupDirection: response.lookupDirection,
          disclosureMode: response.disclosureMode,
          platform: response.platform ?? lookupInput.platformNormalized,
        },
        lookup,
      });
    } catch (error: unknown) {
      const concurrentIdempotentResponse = await this.getStoredConfirmResponse({
        partnerId: requestContext.authenticatedPartner.partnerId,
        idempotencyKey: requestContext.idempotencyKey,
        requestFingerprint,
      });

      if (concurrentIdempotentResponse && this.isUniqueConstraintError(error)) {
        return concurrentIdempotentResponse;
      }

      throw error;
    }

    return response;
  }

  async verify(
    verifyDestinationDto: VerifyDestinationDto,
    requestContext: ResolutionRequestContext,
  ): Promise<VerifyResponse> {
    const lookupInput = this.normalizeLookupInput(
      verifyDestinationDto.recipientIdentifier,
      verifyDestinationDto.chain,
      verifyDestinationDto.asset,
    );
    const normalizedAddress = this.normalizationService.normalizeAddress(
      lookupInput.chainNormalized,
      verifyDestinationDto.address,
    );
    const requestFingerprint = this.buildRequestFingerprint({
      queryType: QueryType.VERIFY_ADDRESS,
      platformNormalized: null,
      recipientIdentifierNormalized: lookupInput.recipientIdentifierNormalized,
      chainNormalized: lookupInput.chainNormalized,
      assetCodeNormalized: lookupInput.assetCodeNormalized,
      assetSymbolNormalized: lookupInput.assetSymbolNormalized,
      providedAddressNormalized: normalizedAddress,
    });
    const idempotentResponse = await this.getStoredVerifyResponse({
      partnerId: requestContext.authenticatedPartner.partnerId,
      idempotencyKey: requestContext.idempotencyKey,
      requestFingerprint,
    });

    if (idempotentResponse) {
      return idempotentResponse;
    }

    const lookupDecision =
      await this.requestHardeningService.evaluateResolutionLookup({
        partnerId: requestContext.authenticatedPartner.partnerId,
        queryType: QueryType.VERIFY_ADDRESS,
        recipientIdentifierNormalized:
          lookupInput.recipientIdentifierNormalized,
      });

    if (!lookupDecision.allowed) {
      await this.blockResolutionLookup({
        authenticatedPartner: requestContext.authenticatedPartner,
        queryType: QueryType.VERIFY_ADDRESS,
        recipientIdentifier: lookupInput.recipientIdentifierInput,
        recipientIdentifierNormalized:
          lookupInput.recipientIdentifierNormalized,
        platformInput: null,
        chainInput: lookupInput.chainInput,
        assetInput: lookupInput.assetInput,
        providedAddressRaw: verifyDestinationDto.address.trim(),
        providedAddressNormalized: normalizedAddress,
        lookupDecision,
      });
    }

    const lookup = await this.lookupVerifiedDestination(lookupInput);
    const flags = [...lookup.flags];
    let riskLevel = lookup.riskLevel;
    let recommendation = lookup.recommendation;
    let match = false;

    if (lookup.address) {
      const normalizedResolvedAddress =
        this.normalizationService.normalizeAddress(
          lookupInput.chainNormalized,
          lookup.address,
        );

      match = normalizedAddress === normalizedResolvedAddress;

      if (!match) {
        flags.push(RiskSignalKind.ADDRESS_MISMATCH);
        riskLevel = RiskLevel.HIGH;
        recommendation = 'do_not_send';

        if (
          this.normalizationService.addressLooksLikeReference(
            normalizedAddress,
            normalizedResolvedAddress,
          )
        ) {
          flags.push(RiskSignalKind.ADDRESS_LOOKALIKE);
        }
      }
    }

    const response: VerifyResponse = {
      lookupDirection: 'TRANSFER_VERIFICATION',
      disclosureMode: lookup.disclosureMode ?? 'FULL_LABEL',
      match,
      verified: lookup.verified && match,
      recipientDisplayName: lookup.recipientDisplayName ?? null,
      platform: lookup.platform ?? null,
      riskLevel,
      flags,
      recommendation,
    };

    try {
      await this.recordResolutionRequest({
        queryType: QueryType.VERIFY_ADDRESS,
        requesterPartnerId: requestContext.authenticatedPartner.partnerId,
        recipientIdentifier: lookupInput.recipientIdentifierInput,
        recipientIdentifierNormalized:
          lookupInput.recipientIdentifierNormalized,
        platformInput: null,
        chainInput: lookupInput.chainInput,
        assetInput: lookupInput.assetInput,
        address: verifyDestinationDto.address,
        normalizedAddress,
        idempotencyKey: requestContext.idempotencyKey,
        requestFingerprint,
        responseData: response,
        metadata: {
          lookupDirection: response.lookupDirection,
          disclosureMode: response.disclosureMode,
          platform: response.platform,
          resolutionContext: 'RECIPIENT_CONTEXT',
        },
        lookup: {
          ...lookup,
          outcome: match ? lookup.outcome : ResolutionOutcome.MISMATCH,
          riskLevel,
          recommendation,
          flags,
        },
      });
    } catch (error: unknown) {
      const concurrentIdempotentResponse = await this.getStoredVerifyResponse({
        partnerId: requestContext.authenticatedPartner.partnerId,
        idempotencyKey: requestContext.idempotencyKey,
        requestFingerprint,
      });

      if (concurrentIdempotentResponse && this.isUniqueConstraintError(error)) {
        return concurrentIdempotentResponse;
      }

      throw error;
    }

    return response;
  }

  async batchVerify(
    batchVerifyDto: BatchVerifyDto,
    requestContext: ResolutionRequestContext,
  ): Promise<BatchVerifyResponse> {
    const configuredMaxRows = this.configService.get(
      'RESOLUTION_BATCH_MAX_ROWS',
      {
        infer: true,
      },
    );

    if (batchVerifyDto.rows.length === 0) {
      throw new BadRequestException(
        'At least one batch verification row is required.',
      );
    }

    if (batchVerifyDto.rows.length > configuredMaxRows) {
      throw new BadRequestException(
        `Batch verification supports at most ${configuredMaxRows} rows.`,
      );
    }

    const lookupMode = this.readBatchLookupMode(batchVerifyDto.lookupMode);
    this.assertBatchLookupRequirements(batchVerifyDto, lookupMode);
    const normalizedChain = this.normalizationService.normalizeChain(
      batchVerifyDto.chain,
    );
    const normalizedAssetSymbol =
      this.normalizationService.normalizeAssetSymbol(batchVerifyDto.asset);
    const startedAt = Date.now();
    const batchRun = await this.prismaService.resolutionBatchRun.create({
      data: {
        partnerId: requestContext.authenticatedPartner.partnerId,
        requestedByUserId: requestContext.authenticatedPartner.partnerUserId,
        inputFormat: batchVerifyDto.inputFormat,
        chainInput: normalizedChain,
        assetInput: normalizedAssetSymbol,
        stopOnFirstHighRisk: batchVerifyDto.stopOnFirstHighRisk ?? false,
        requireExactAttestedMatch:
          batchVerifyDto.requireExactAttestedMatch ?? true,
        rowCount: batchVerifyDto.rows.length,
      },
      select: {
        id: true,
      },
    });

    const rows: BatchVerifyRowResponse[] = [];
    let verifiedRows = 0;
    let warningRows = 0;
    let blockedRows = 0;
    let unsupportedRows = 0;

    for (const [index, row] of batchVerifyDto.rows.entries()) {
      let rowResponse: BatchVerifyRowResponse;
      let recordedOutcome: ResolutionOutcome = ResolutionOutcome.ERROR;
      let recordedRiskLevel: RiskLevel = RiskLevel.HIGH;
      let recordedFlags: RiskSignalKind[] = [RiskSignalKind.ADDRESS_MISMATCH];
      let recordedRecommendation = 'invalid_request';
      let requestId = '' as string;

      try {
        const rowLookupMode = this.resolveBatchRowLookupMode(
          lookupMode,
          row.lookupMode,
        );

        if (rowLookupMode === 'BY_RECIPIENT') {
          if (!row.recipientIdentifier?.trim()) {
            throw new BadRequestException(
              'Recipient-based batch rows require a recipient identifier.',
            );
          }

          const evaluation = await this.evaluateVerifyLookup(
            row.recipientIdentifier,
            batchVerifyDto.chain,
            batchVerifyDto.asset,
            row.address,
          );
          const requestFingerprint = this.buildRequestFingerprint({
            queryType: QueryType.BATCH_VERIFY,
            platformNormalized: null,
            recipientIdentifierNormalized:
              evaluation.lookupInput.recipientIdentifierNormalized,
            chainNormalized: evaluation.lookupInput.chainNormalized,
            assetCodeNormalized: evaluation.lookupInput.assetCodeNormalized,
            assetSymbolNormalized: evaluation.lookupInput.assetSymbolNormalized,
            providedAddressNormalized: evaluation.normalizedAddress,
          });

          const request = await this.recordResolutionRequest({
            queryType: QueryType.BATCH_VERIFY,
            requesterPartnerId: requestContext.authenticatedPartner.partnerId,
            resolutionBatchRunId: batchRun.id,
            recipientIdentifier: row.recipientIdentifier.trim(),
            recipientIdentifierNormalized:
              evaluation.lookupInput.recipientIdentifierNormalized,
            platformInput: null,
            chainInput: batchVerifyDto.chain.trim(),
            assetInput: batchVerifyDto.asset.trim(),
            address: row.address.trim(),
            normalizedAddress: evaluation.normalizedAddress,
            idempotencyKey: null,
            requestFingerprint,
            responseData: evaluation.response,
            metadata: {
              lookupMode: rowLookupMode,
              lookupDirection: evaluation.response.lookupDirection,
              disclosureMode: evaluation.response.disclosureMode,
              platform: evaluation.response.platform,
            },
            lookup: evaluation.lookup,
          });

          await this.prismaService.resolutionBatchRow.create({
            data: {
              batchRunId: batchRun.id,
              rowIndex: index,
              clientReference: row.clientReference?.trim() || null,
              recipientIdentifierInput: row.recipientIdentifier.trim(),
              submittedAddressRaw: row.address.trim(),
              outcome: evaluation.lookup.outcome,
              riskLevel: evaluation.lookup.riskLevel,
              recommendation: evaluation.lookup.recommendation,
              flags: evaluation.lookup.flags,
              responseData: {
                ...evaluation.response,
                lookupMode: rowLookupMode,
              },
            },
          });

          rowResponse = {
            clientReference: row.clientReference?.trim() || null,
            lookupMode: rowLookupMode,
            platform: evaluation.response.platform,
            recipientIdentifier: row.recipientIdentifier.trim(),
            submittedAddress: row.address.trim(),
            match: evaluation.response.match,
            verified: evaluation.response.verified,
            recipientDisplayName: evaluation.response.recipientDisplayName,
            disclosureMode: evaluation.response.disclosureMode,
            riskLevel: evaluation.response.riskLevel,
            flags: evaluation.response.flags,
            recommendation: evaluation.response.recommendation,
          };
          recordedOutcome = evaluation.lookup.outcome;
          recordedRiskLevel = evaluation.lookup.riskLevel;
          recordedFlags = evaluation.lookup.flags;
          recordedRecommendation = evaluation.lookup.recommendation;
          requestId = request.id;
        } else {
          if (!row.platform?.trim()) {
            throw new BadRequestException(
              'Address-based batch rows require a platform.',
            );
          }

          const evaluation = await this.evaluateConfirmLookup(
            row.platform,
            batchVerifyDto.chain,
            batchVerifyDto.asset,
            row.address,
          );
          const requestFingerprint = this.buildRequestFingerprint({
            queryType: QueryType.BATCH_VERIFY,
            platformNormalized: evaluation.lookupInput.platformNormalized,
            recipientIdentifierNormalized: '',
            chainNormalized: evaluation.lookupInput.chainNormalized,
            assetCodeNormalized: evaluation.lookupInput.assetCodeNormalized,
            assetSymbolNormalized: evaluation.lookupInput.assetSymbolNormalized,
            providedAddressNormalized: evaluation.lookupInput.addressNormalized,
          });

          const request = await this.recordResolutionRequest({
            queryType: QueryType.BATCH_VERIFY,
            requesterPartnerId: requestContext.authenticatedPartner.partnerId,
            resolutionBatchRunId: batchRun.id,
            recipientIdentifier:
              evaluation.response.recipientDisplayName ?? row.platform.trim(),
            recipientIdentifierNormalized: '',
            platformInput: row.platform.trim(),
            chainInput: batchVerifyDto.chain.trim(),
            assetInput: batchVerifyDto.asset.trim(),
            address: row.address.trim(),
            normalizedAddress: evaluation.lookupInput.addressNormalized,
            idempotencyKey: null,
            requestFingerprint,
            responseData: evaluation.response,
            metadata: {
              lookupMode: rowLookupMode,
              lookupDirection: evaluation.response.lookupDirection,
              disclosureMode: evaluation.response.disclosureMode,
              platform: evaluation.response.platform,
            },
            lookup: evaluation.lookup,
          });

          await this.prismaService.resolutionBatchRow.create({
            data: {
              batchRunId: batchRun.id,
              rowIndex: index,
              clientReference: row.clientReference?.trim() || null,
              recipientIdentifierInput: row.platform.trim(),
              submittedAddressRaw: row.address.trim(),
              outcome: evaluation.lookup.outcome,
              riskLevel: evaluation.lookup.riskLevel,
              recommendation: evaluation.lookup.recommendation,
              flags: evaluation.lookup.flags,
              responseData: {
                ...evaluation.response,
                lookupMode: rowLookupMode,
              },
            },
          });

          rowResponse = {
            clientReference: row.clientReference?.trim() || null,
            lookupMode: rowLookupMode,
            platform: evaluation.response.platform,
            recipientIdentifier: null,
            submittedAddress: row.address.trim(),
            match: evaluation.response.confirmed,
            verified: evaluation.response.verified,
            recipientDisplayName: evaluation.response.recipientDisplayName,
            disclosureMode: evaluation.response.disclosureMode,
            riskLevel: evaluation.response.riskLevel,
            flags: evaluation.response.flags,
            recommendation: evaluation.response.recommendation,
          };
          recordedOutcome = evaluation.lookup.outcome;
          recordedRiskLevel = evaluation.lookup.riskLevel;
          recordedFlags = evaluation.lookup.flags;
          recordedRecommendation = evaluation.lookup.recommendation;
          requestId = request.id;
        }
      } catch (error: unknown) {
        rowResponse = {
          clientReference: row.clientReference?.trim() || null,
          lookupMode: this.resolveBatchRowLookupMode(
            lookupMode,
            row.lookupMode,
          ),
          platform: row.platform?.trim() ?? null,
          recipientIdentifier: row.recipientIdentifier?.trim() || null,
          submittedAddress: row.address.trim(),
          match: false,
          verified: false,
          recipientDisplayName: null,
          disclosureMode: null,
          riskLevel: RiskLevel.HIGH,
          flags: [RiskSignalKind.ADDRESS_MISMATCH],
          recommendation:
            error instanceof Error ? error.message : 'invalid_request',
        };

        await this.prismaService.resolutionBatchRow.create({
          data: {
            batchRunId: batchRun.id,
            rowIndex: index,
            clientReference: row.clientReference?.trim() || null,
            recipientIdentifierInput:
              row.recipientIdentifier?.trim() || row.platform?.trim() || '',
            submittedAddressRaw: row.address.trim(),
            outcome: ResolutionOutcome.ERROR,
            riskLevel: RiskLevel.HIGH,
            recommendation:
              error instanceof Error ? error.message : 'invalid_request',
            flags: [RiskSignalKind.ADDRESS_MISMATCH],
            responseData: rowResponse,
          },
        });
      }

      rows.push(rowResponse);

      if (rowResponse.verified) {
        verifiedRows += 1;
      } else if (recordedRecommendation === 'unsupported_asset_network') {
        unsupportedRows += 1;
      } else if (
        recordedRiskLevel === RiskLevel.HIGH ||
        recordedRiskLevel === RiskLevel.CRITICAL
      ) {
        blockedRows += 1;
      } else {
        warningRows += 1;
      }

      await this.auditService.recordEvent({
        actorType: AuditActorType.PARTNER,
        actorPartnerId: requestContext.authenticatedPartner.partnerId,
        subjectPartnerId: requestContext.authenticatedPartner.partnerId,
        actorIdentifier: requestContext.authenticatedPartner.actorIdentifier,
        action: 'resolution.batch.row_processed',
        entityType: requestId ? 'ResolutionRequest' : 'ResolutionBatchRow',
        entityId: requestId || `${batchRun.id}:${index}`,
        summary: `Processed batch verification row ${index + 1}.`,
        metadata: {
          batchRunId: batchRun.id,
          rowIndex: index,
          recipientIdentifier: row.recipientIdentifier.trim(),
          outcome: recordedOutcome,
          riskLevel: recordedRiskLevel,
          flags: recordedFlags,
        },
      });

      if (
        batchVerifyDto.stopOnFirstHighRisk &&
        (recordedRiskLevel === RiskLevel.HIGH ||
          recordedRiskLevel === RiskLevel.CRITICAL)
      ) {
        break;
      }
    }

    await this.prismaService.resolutionBatchRun.update({
      where: {
        id: batchRun.id,
      },
      data: {
        verifiedCount: verifiedRows,
        warningCount: warningRows,
        blockedCount: blockedRows,
        unsupportedCount: unsupportedRows,
        durationMs: Date.now() - startedAt,
        completedAt: new Date(),
      },
    });

    return {
      batchRunId: batchRun.id,
      inputFormat: batchVerifyDto.inputFormat,
      lookupMode,
      chain: batchVerifyDto.chain.trim(),
      asset: batchVerifyDto.asset.trim(),
      totalRows: rows.length,
      verifiedRows,
      warningRows,
      blockedRows,
      unsupportedRows,
      rows,
    };
  }

  async listResolutionLogs(
    partnerId: string,
    params: Omit<ListResolutionLogsDto, 'limit'> & { limit: number },
  ) {
    const logs = await this.prismaService.resolutionRequest.findMany({
      where: {
        requesterPartnerId: partnerId,
        queryType: params.queryType,
        outcome: params.outcome,
        riskLevel: params.riskLevel,
        ...(params.chain
          ? {
              chainInput: this.normalizationService.normalizeChain(
                params.chain,
              ),
            }
          : {}),
        ...(params.asset
          ? {
              assetInput: {
                in: [
                  this.normalizationService.normalizeAssetCode(params.asset),
                  this.normalizationService.normalizeAssetSymbol(params.asset),
                  params.asset.trim(),
                ],
              },
            }
          : {}),
        ...(params.recipientIdentifier
          ? {
              recipientIdentifierNormalized:
                this.normalizationService.normalizeIdentifier(
                  params.recipientIdentifier,
                ),
            }
          : {}),
        ...(params.platform
          ? {
              platformInput: this.normalizationService.normalizePartnerSlug(
                params.platform,
              ),
            }
          : {}),
      },
      orderBy: {
        requestedAt: 'desc',
      },
      take: params.limit,
      select: {
        id: true,
        queryType: true,
        recipientIdentifierInput: true,
        platformInput: true,
        chainInput: true,
        assetInput: true,
        providedAddressRaw: true,
        outcome: true,
        riskLevel: true,
        recommendation: true,
        flags: true,
        requestedAt: true,
        respondedAt: true,
        metadata: true,
        responseData: true,
      },
    });

    return logs.map((log) => ({
      id: log.id,
      queryType: log.queryType,
      recipientIdentifier: log.recipientIdentifierInput,
      platform: log.platformInput,
      chain: log.chainInput,
      asset: log.assetInput,
      providedAddress: log.providedAddressRaw,
      outcome: log.outcome,
      riskLevel: log.riskLevel,
      recommendation: log.recommendation,
      flags: log.flags,
      lookupDirection: this.resolveLookupDirection(log.queryType, log.metadata),
      disclosureMode: this.readDisclosureMode(log.responseData, log.metadata),
      requestedAt: log.requestedAt.toISOString(),
      respondedAt: log.respondedAt?.toISOString() ?? null,
    }));
  }

  async getResolutionLog(partnerId: string, requestId: string) {
    const log = await this.prismaService.resolutionRequest.findFirst({
      where: {
        id: requestId,
        requesterPartnerId: partnerId,
      },
      include: {
        resolvedRecipient: {
          select: {
            id: true,
            externalRecipientId: true,
            displayName: true,
          },
        },
        resolvedIdentifier: {
          select: {
            id: true,
            rawValue: true,
            normalizedValue: true,
            kind: true,
          },
        },
        resolvedDestination: {
          select: {
            id: true,
            addressRaw: true,
            addressNormalized: true,
            memoValue: true,
            status: true,
          },
        },
        resolvedAttestation: {
          select: {
            id: true,
            attestationType: true,
            verificationStatus: true,
            issuedAt: true,
            expiresAt: true,
          },
        },
        riskSignals: {
          select: {
            kind: true,
            severity: true,
            details: true,
            createdAt: true,
          },
        },
      },
    });

    if (!log) {
      return null;
    }

    return {
      id: log.id,
      queryType: log.queryType,
      recipientIdentifierInput: log.recipientIdentifierInput,
      recipientIdentifierNormalized: log.recipientIdentifierNormalized,
      platformInput: log.platformInput,
      chainInput: log.chainInput,
      assetInput: log.assetInput,
      providedAddressRaw: log.providedAddressRaw,
      providedAddressNormalized: log.providedAddressNormalized,
      outcome: log.outcome,
      riskLevel: log.riskLevel,
      recommendation: log.recommendation,
      flags: log.flags,
      requestedAt: log.requestedAt.toISOString(),
      respondedAt: log.respondedAt?.toISOString() ?? null,
      lookupDirection: this.resolveLookupDirection(log.queryType, log.metadata),
      disclosureMode: this.readDisclosureMode(log.responseData, log.metadata),
      responseData: log.responseData,
      metadata: log.metadata,
      resolvedRecipient: log.resolvedRecipient,
      resolvedIdentifier: log.resolvedIdentifier,
      resolvedDestination: log.resolvedDestination,
      resolvedAttestation: log.resolvedAttestation
        ? {
            ...log.resolvedAttestation,
            issuedAt: log.resolvedAttestation.issuedAt.toISOString(),
            expiresAt: log.resolvedAttestation.expiresAt?.toISOString() ?? null,
          }
        : null,
      riskSignals: log.riskSignals.map((signal) => ({
        kind: signal.kind,
        severity: signal.severity,
        details: signal.details,
        createdAt: signal.createdAt.toISOString(),
      })),
    };
  }

  async cleanupHistoricalResolutionRequests(
    retentionMs: number,
  ): Promise<number> {
    const cutoff = new Date(Date.now() - retentionMs);
    const deletedRequests =
      await this.prismaService.resolutionRequest.deleteMany({
        where: {
          requestedAt: {
            lt: cutoff,
          },
        },
      });

    return deletedRequests.count;
  }

  private normalizeLookupInput(
    recipientIdentifier: string,
    chain: string,
    asset: string,
  ): NormalizedLookupInput {
    const recipientIdentifierInput = recipientIdentifier.trim();
    const chainInput = chain.trim();
    const assetInput = asset.trim();

    return {
      recipientIdentifierInput,
      recipientIdentifierNormalized:
        this.normalizationService.normalizeIdentifier(recipientIdentifierInput),
      chainInput,
      chainNormalized: this.normalizationService.normalizeChain(chainInput),
      assetInput,
      assetCodeNormalized:
        this.normalizationService.normalizeAssetCode(assetInput),
      assetSymbolNormalized:
        this.normalizationService.normalizeAssetSymbol(assetInput),
    };
  }

  private normalizeConfirmInput(
    confirmRecipientDto: ConfirmRecipientDto,
  ): NormalizedConfirmInput {
    const platformInput = confirmRecipientDto.platform?.trim() || null;
    const chainInput = confirmRecipientDto.chain.trim();
    const assetInput = confirmRecipientDto.asset.trim();
    const addressInput = confirmRecipientDto.address.trim();

    const platformNormalized = platformInput
      ? this.normalizationService.normalizePartnerSlug(platformInput)
      : null;
    const chainNormalized =
      this.normalizationService.normalizeChain(chainInput);

    return {
      platformInput,
      platformNormalized,
      chainInput,
      chainNormalized,
      assetInput,
      assetCodeNormalized:
        this.normalizationService.normalizeAssetCode(assetInput),
      assetSymbolNormalized:
        this.normalizationService.normalizeAssetSymbol(assetInput),
      addressInput,
      addressNormalized: this.normalizationService.normalizeAddress(
        chainNormalized,
        addressInput,
      ),
    };
  }

  private async findAssetNetworkForLookup(params: {
    chainNormalized: string;
    assetCodeNormalized: string;
    assetSymbolNormalized: string;
  }) {
    return this.prismaService.assetNetwork.findFirst({
      where: {
        chain: {
          slug: params.chainNormalized,
          isActive: true,
        },
        isActive: true,
        asset: {
          OR: [
            { code: params.assetCodeNormalized },
            { symbol: params.assetSymbolNormalized },
          ],
        },
      },
      include: {
        asset: true,
        chain: true,
      },
    });
  }

  private async lookupVerifiedDestination(
    lookupInput: NormalizedLookupInput,
  ): Promise<LookupResult> {
    const identifier = await this.recipientsService.findResolvableIdentifier(
      lookupInput.recipientIdentifierNormalized,
    );

    if (!identifier) {
      return {
        outcome: ResolutionOutcome.NO_MATCH,
        riskLevel: RiskLevel.HIGH,
        recommendation: 'recipient_not_found',
        flags: [RiskSignalKind.IDENTIFIER_MISMATCH],
        verified: false,
        disclosureMode: 'FULL_LABEL',
      };
    }

    const assetNetwork = await this.findAssetNetworkForLookup({
      chainNormalized: lookupInput.chainNormalized,
      assetCodeNormalized: lookupInput.assetCodeNormalized,
      assetSymbolNormalized: lookupInput.assetSymbolNormalized,
    });

    if (!assetNetwork) {
      return {
        outcome: ResolutionOutcome.UNVERIFIED,
        riskLevel: RiskLevel.HIGH,
        recommendation: 'unsupported_asset_network',
        flags: [RiskSignalKind.UNSUPPORTED_ASSET_NETWORK],
        verified: false,
        recipientDisplayName: identifier.recipient.displayName,
        platform: identifier.recipient.partner.slug,
        disclosureMode: 'FULL_LABEL',
      };
    }

    const destinations = await this.recipientsService.getActiveDestinations({
      recipientId: identifier.recipientId,
      assetNetworkId: assetNetwork.id,
      now: new Date(),
    });

    if (destinations.length === 0) {
      return {
        outcome: ResolutionOutcome.UNVERIFIED,
        riskLevel: RiskLevel.HIGH,
        recommendation: 'no_verified_destination',
        flags: [RiskSignalKind.ADDRESS_NOT_ATTESTED],
        verified: false,
        recipientDisplayName: identifier.recipient.displayName,
        platform: identifier.recipient.partner.slug,
        disclosureMode: 'FULL_LABEL',
      };
    }

    if (destinations.length > 1) {
      return {
        outcome: ResolutionOutcome.AMBIGUOUS,
        riskLevel: RiskLevel.CRITICAL,
        recommendation: 'manual_review_required',
        flags: [RiskSignalKind.MULTIPLE_ACTIVE_DESTINATIONS],
        verified: false,
        recipientDisplayName: identifier.recipient.displayName,
        platform: identifier.recipient.partner.slug,
        disclosureMode: 'FULL_LABEL',
      };
    }

    const destination = destinations[0];
    const latestAttestation = await this.prismaService.attestation.findFirst({
      where: {
        destinationId: destination.id,
        verificationStatus: VerificationStatus.VERIFIED,
      },
      orderBy: {
        issuedAt: 'desc',
      },
    });

    return {
      outcome: ResolutionOutcome.RESOLVED,
      riskLevel: RiskLevel.LOW,
      recommendation: 'safe_to_send',
      flags: [],
      verified: true,
      recipientDisplayName: identifier.recipient.displayName,
      platform: identifier.recipient.partner.slug,
      address: destination.addressRaw,
      chain: assetNetwork.chain.slug,
      asset: assetNetwork.asset.symbol,
      expiresAt: destination.expiresAt?.toISOString() ?? null,
      recipientId: identifier.recipientId,
      identifierId: identifier.id,
      destinationId: destination.id,
      attestationId: latestAttestation?.id,
      disclosureMode: 'FULL_LABEL',
    };
  }

  private async lookupRecipientConfirmation(
    lookupInput: NormalizedConfirmInput,
  ): Promise<LookupResult> {
    const assetNetwork = await this.findAssetNetworkForLookup({
      chainNormalized: lookupInput.chainNormalized,
      assetCodeNormalized: lookupInput.assetCodeNormalized,
      assetSymbolNormalized: lookupInput.assetSymbolNormalized,
    });

    if (!assetNetwork) {
      return {
        outcome: ResolutionOutcome.UNVERIFIED,
        riskLevel: RiskLevel.HIGH,
        recommendation: 'unsupported_asset_network',
        flags: [RiskSignalKind.UNSUPPORTED_ASSET_NETWORK],
        verified: false,
        platform: lookupInput.platformNormalized,
        chain: lookupInput.chainNormalized,
        asset: lookupInput.assetSymbolNormalized,
        disclosureMode: 'VERIFICATION_ONLY',
        candidatePlatforms: [],
        requiresPlatformSelection: false,
      };
    }

    const now = new Date();
    const destinations = await this.prismaService.recipientDestination.findMany(
      {
        where: {
          addressNormalized: lookupInput.addressNormalized,
          assetNetworkId: assetNetwork.id,
          status: DestinationStatus.ACTIVE,
          effectiveFrom: {
            lte: now,
          },
          OR: [
            {
              expiresAt: null,
            },
            {
              expiresAt: {
                gt: now,
              },
            },
          ],
          recipient: {
            partner: {
              ...(lookupInput.platformNormalized
                ? {
                    slug: lookupInput.platformNormalized,
                  }
                : {
                    isDirectoryListed: true,
                  }),
            },
          },
        },
        include: {
          recipient: {
            include: {
              partner: true,
              identifiers: {
                orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }],
                take: 1,
              },
            },
          },
        },
        orderBy: [{ isDefault: 'desc' }, { lastAttestedAt: 'desc' }],
      },
    );

    const activeDestinations = destinations.filter(
      (destination) =>
        destination.recipient.status === RecipientStatus.ACTIVE &&
        destination.recipient.partner.status === PartnerStatus.ACTIVE,
    );

    if (activeDestinations.length === 0) {
      return {
        outcome: ResolutionOutcome.NO_MATCH,
        riskLevel: RiskLevel.HIGH,
        recommendation: 'address_not_confirmed',
        flags: [RiskSignalKind.ADDRESS_NOT_ATTESTED],
        verified: false,
        platform: lookupInput.platformNormalized,
        chain: assetNetwork.chain.slug,
        asset: assetNetwork.asset.symbol,
        disclosureMode: 'VERIFICATION_ONLY',
        candidatePlatforms: [],
        requiresPlatformSelection: false,
      };
    }

    const candidatePlatforms = Array.from(
      new Map(
        activeDestinations.map((destination) => [
          destination.recipient.partner.id,
          {
            id: destination.recipient.partner.id,
            slug: destination.recipient.partner.slug,
            displayName: destination.recipient.partner.displayName,
          },
        ]),
      ).values(),
    ).sort((left, right) =>
      left.displayName.localeCompare(right.displayName, 'en'),
    );

    if (activeDestinations.length > 1) {
      if (!lookupInput.platformNormalized && candidatePlatforms.length > 1) {
        return {
          outcome: ResolutionOutcome.AMBIGUOUS,
          riskLevel: RiskLevel.HIGH,
          recommendation: 'select_platform',
          flags: [RiskSignalKind.MULTIPLE_ACTIVE_DESTINATIONS],
          verified: false,
          platform: null,
          chain: assetNetwork.chain.slug,
          asset: assetNetwork.asset.symbol,
          disclosureMode: 'VERIFICATION_ONLY',
          candidatePlatforms,
          requiresPlatformSelection: true,
        };
      }

      return {
        outcome: ResolutionOutcome.AMBIGUOUS,
        riskLevel: RiskLevel.CRITICAL,
        recommendation: 'manual_review_required',
        flags: [RiskSignalKind.MULTIPLE_ACTIVE_DESTINATIONS],
        verified: false,
        platform:
          lookupInput.platformNormalized ?? candidatePlatforms[0]?.slug ?? null,
        chain: assetNetwork.chain.slug,
        asset: assetNetwork.asset.symbol,
        disclosureMode: 'VERIFICATION_ONLY',
        candidatePlatforms,
        requiresPlatformSelection: false,
      };
    }

    const destination = activeDestinations[0];
    const primaryIdentifier = destination.recipient.identifiers[0] ?? null;
    const latestAttestation = await this.prismaService.attestation.findFirst({
      where: {
        destinationId: destination.id,
        verificationStatus: VerificationStatus.VERIFIED,
      },
      orderBy: {
        issuedAt: 'desc',
      },
    });
    const recipientDisplayName =
      destination.recipient.displayName ??
      primaryIdentifier?.rawValue ??
      destination.recipient.externalRecipientId;
    const disclosureMode: DisclosureMode = recipientDisplayName
      ? 'FULL_LABEL'
      : 'VERIFICATION_ONLY';

    return {
      outcome: ResolutionOutcome.RESOLVED,
      riskLevel: RiskLevel.LOW,
      recommendation: 'safe_to_send',
      flags: [],
      verified: true,
      recipientDisplayName:
        disclosureMode === 'FULL_LABEL' ? recipientDisplayName : null,
      platform: destination.recipient.partner.slug,
      chain: assetNetwork.chain.slug,
      asset: assetNetwork.asset.symbol,
      expiresAt: destination.expiresAt?.toISOString() ?? null,
      recipientId: destination.recipientId,
      identifierId: primaryIdentifier?.id,
      destinationId: destination.id,
      attestationId: latestAttestation?.id,
      disclosureMode,
      candidatePlatforms: [],
      requiresPlatformSelection: false,
    };
  }

  private async evaluateVerifyLookup(
    recipientIdentifier: string,
    chain: string,
    asset: string,
    address: string,
  ): Promise<{
    lookup: LookupResult;
    lookupInput: NormalizedLookupInput;
    normalizedAddress: string;
    response: VerifyResponse;
  }> {
    const lookupInput = this.normalizeLookupInput(
      recipientIdentifier,
      chain,
      asset,
    );
    const normalizedAddress = this.normalizationService.normalizeAddress(
      lookupInput.chainNormalized,
      address,
    );
    const lookup = await this.lookupVerifiedDestination(lookupInput);
    const flags = [...lookup.flags];
    let riskLevel = lookup.riskLevel;
    let recommendation = lookup.recommendation;
    let match = false;
    let outcome = lookup.outcome;

    if (lookup.address) {
      const normalizedResolvedAddress =
        this.normalizationService.normalizeAddress(
          lookupInput.chainNormalized,
          lookup.address,
        );

      match = normalizedAddress === normalizedResolvedAddress;

      if (!match) {
        flags.push(RiskSignalKind.ADDRESS_MISMATCH);
        riskLevel = RiskLevel.HIGH;
        recommendation = 'do_not_send';
        outcome = ResolutionOutcome.MISMATCH;

        if (
          this.normalizationService.addressLooksLikeReference(
            normalizedAddress,
            normalizedResolvedAddress,
          )
        ) {
          flags.push(RiskSignalKind.ADDRESS_LOOKALIKE);
        }
      }
    }

    return {
      lookup: {
        ...lookup,
        outcome,
        riskLevel,
        recommendation,
        flags,
      },
      lookupInput,
      normalizedAddress,
      response: {
        lookupDirection: 'TRANSFER_VERIFICATION',
        disclosureMode: lookup.disclosureMode ?? 'FULL_LABEL',
        match,
        verified: lookup.verified && match,
        recipientDisplayName: lookup.recipientDisplayName ?? null,
        platform: lookup.platform ?? null,
        riskLevel,
        flags,
        recommendation,
      },
    };
  }

  private async evaluateConfirmLookup(
    platform: string,
    chain: string,
    asset: string,
    address: string,
  ): Promise<{
    lookup: LookupResult;
    lookupInput: NormalizedConfirmInput;
    response: ConfirmResponse;
  }> {
    const lookupInput = this.normalizeConfirmInput({
      platform,
      address,
      chain,
      asset,
    });
    const lookup = await this.lookupRecipientConfirmation(lookupInput);

    return {
      lookup,
      lookupInput,
      response: {
        lookupDirection: 'REVERSE_LOOKUP',
        disclosureMode: lookup.disclosureMode ?? 'VERIFICATION_ONLY',
        confirmed: lookup.verified,
        verified: lookup.verified,
        recipientDisplayName: lookup.recipientDisplayName ?? null,
        platform: lookup.platform ?? null,
        chain: lookup.chain ?? null,
        asset: lookup.asset ?? null,
        expiresAt: lookup.expiresAt ?? null,
        riskLevel: lookup.riskLevel,
        flags: lookup.flags,
        recommendation: lookup.recommendation,
        candidatePlatforms: lookup.candidatePlatforms ?? [],
        requiresPlatformSelection: lookup.requiresPlatformSelection ?? false,
      },
    };
  }

  private async getStoredResolveResponse(params: {
    partnerId: string;
    idempotencyKey: string | null;
    requestFingerprint: string;
  }): Promise<ResolveResponse | null> {
    const storedRequest = await this.findStoredIdempotentRequest({
      partnerId: params.partnerId,
      queryType: QueryType.RESOLVE,
      idempotencyKey: params.idempotencyKey,
      requestFingerprint: params.requestFingerprint,
    });

    if (!storedRequest) {
      return null;
    }

    if (!isResolveResponse(storedRequest.responseData)) {
      throw new InternalServerErrorException(
        'Stored resolve idempotency response is invalid.',
      );
    }

    return storedRequest.responseData;
  }

  private async getStoredConfirmResponse(params: {
    partnerId: string;
    idempotencyKey: string | null;
    requestFingerprint: string;
  }): Promise<ConfirmResponse | null> {
    const storedRequest = await this.findStoredIdempotentRequest({
      partnerId: params.partnerId,
      queryType: QueryType.CONFIRM_ADDRESS,
      idempotencyKey: params.idempotencyKey,
      requestFingerprint: params.requestFingerprint,
    });

    if (!storedRequest) {
      return null;
    }

    if (!isConfirmResponse(storedRequest.responseData)) {
      throw new InternalServerErrorException(
        'Stored confirm idempotency response is invalid.',
      );
    }

    return storedRequest.responseData;
  }

  private async getStoredVerifyResponse(params: {
    partnerId: string;
    idempotencyKey: string | null;
    requestFingerprint: string;
  }): Promise<VerifyResponse | null> {
    const storedRequest = await this.findStoredIdempotentRequest({
      partnerId: params.partnerId,
      queryType: QueryType.VERIFY_ADDRESS,
      idempotencyKey: params.idempotencyKey,
      requestFingerprint: params.requestFingerprint,
    });

    if (!storedRequest) {
      return null;
    }

    if (!isVerifyResponse(storedRequest.responseData)) {
      throw new InternalServerErrorException(
        'Stored verify idempotency response is invalid.',
      );
    }

    return storedRequest.responseData;
  }

  private async findStoredIdempotentRequest(params: {
    partnerId: string;
    queryType: QueryType;
    idempotencyKey: string | null;
    requestFingerprint: string;
  }) {
    if (!params.idempotencyKey) {
      return null;
    }

    const storedRequest = await this.prismaService.resolutionRequest.findFirst({
      where: {
        requesterPartnerId: params.partnerId,
        queryType: params.queryType,
        idempotencyKey: params.idempotencyKey,
      },
      select: {
        requestFingerprint: true,
        responseData: true,
      },
    });

    if (!storedRequest) {
      return null;
    }

    if (storedRequest.requestFingerprint !== params.requestFingerprint) {
      throw new ConflictException(
        'Idempotency-Key was already used for a different resolution request.',
      );
    }

    return storedRequest;
  }

  private buildRequestFingerprint(params: {
    queryType: QueryType;
    platformNormalized: string | null;
    recipientIdentifierNormalized: string;
    chainNormalized: string;
    assetCodeNormalized: string;
    assetSymbolNormalized: string;
    providedAddressNormalized: string | null;
  }): string {
    return createHash('sha256')
      .update(
        [
          params.queryType,
          params.platformNormalized ?? '',
          params.recipientIdentifierNormalized,
          params.chainNormalized,
          params.assetCodeNormalized,
          params.assetSymbolNormalized,
          params.providedAddressNormalized ?? '',
        ].join('|'),
      )
      .digest('hex');
  }

  private async blockResolutionLookup(params: {
    authenticatedPartner: AuthenticatedPartner;
    queryType: QueryType;
    recipientIdentifier: string;
    recipientIdentifierNormalized: string;
    platformInput: string | null;
    chainInput: string;
    assetInput: string;
    providedAddressRaw: string | null;
    providedAddressNormalized: string | null;
    lookupDecision: Exclude<ResolutionLookupDecision, { allowed: true }>;
  }): Promise<never> {
    const request = await this.recordResolutionRequest({
      queryType: params.queryType,
      requesterPartnerId: params.authenticatedPartner.partnerId,
      recipientIdentifier: params.recipientIdentifier,
      recipientIdentifierNormalized: params.recipientIdentifierNormalized,
      platformInput: params.platformInput,
      chainInput: params.chainInput,
      assetInput: params.assetInput,
      address: params.providedAddressRaw,
      normalizedAddress: params.providedAddressNormalized,
      idempotencyKey: null,
      requestFingerprint: null,
      responseData: null,
      metadata: params.lookupDecision.metadata,
      lookup: {
        outcome: ResolutionOutcome.BLOCKED,
        riskLevel: params.lookupDecision.riskLevel,
        recommendation: params.lookupDecision.recommendation,
        flags: params.lookupDecision.flags,
        verified: false,
      },
    });

    await this.auditService.recordEvent({
      actorType: AuditActorType.PARTNER,
      actorPartnerId: params.authenticatedPartner.partnerId,
      subjectPartnerId: params.authenticatedPartner.partnerId,
      actorIdentifier: params.authenticatedPartner.partnerSlug,
      action:
        params.lookupDecision.reason === 'enumeration'
          ? 'resolution.lookup.blocked.enumeration'
          : 'resolution.lookup.blocked.rate_limit',
      entityType: 'ResolutionRequest',
      entityId: request.id,
      summary:
        params.lookupDecision.reason === 'enumeration'
          ? 'Blocked resolution lookup due to anti-enumeration control.'
          : 'Blocked resolution lookup due to rate limiting.',
      metadata: params.lookupDecision.metadata,
    });

    throw new HttpException(
      resolutionLookupThrottledMessage,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private async recordResolutionRequest(params: {
    queryType: QueryType;
    requesterPartnerId: string;
    resolutionBatchRunId?: string | null;
    recipientIdentifier: string;
    recipientIdentifierNormalized: string;
    platformInput: string | null;
    chainInput: string;
    assetInput: string;
    address: string | null;
    normalizedAddress: string | null;
    idempotencyKey: string | null;
    requestFingerprint: string | null;
    responseData: Prisma.InputJsonValue | null;
    metadata?: Prisma.InputJsonValue;
    lookup: LookupResult;
  }) {
    const requestData: Prisma.ResolutionRequestUncheckedCreateInput = {
      queryType: params.queryType,
      requesterPartnerId: params.requesterPartnerId,
      resolutionBatchRunId: params.resolutionBatchRunId ?? null,
      recipientIdentifierInput: params.recipientIdentifier,
      recipientIdentifierNormalized: params.recipientIdentifierNormalized,
      platformInput: params.platformInput,
      chainInput: params.chainInput,
      assetInput: params.assetInput,
      providedAddressRaw: params.address,
      providedAddressNormalized: params.normalizedAddress,
      resolvedRecipientId: params.lookup.recipientId ?? null,
      resolvedIdentifierId: params.lookup.identifierId ?? null,
      resolvedDestinationId: params.lookup.destinationId ?? null,
      resolvedAttestationId: params.lookup.attestationId ?? null,
      outcome: params.lookup.outcome,
      riskLevel: params.lookup.riskLevel,
      recommendation: params.lookup.recommendation,
      flags: params.lookup.flags,
      respondedAt: new Date(),
    };

    if (params.idempotencyKey) {
      requestData.idempotencyKey = params.idempotencyKey;
    }

    if (params.requestFingerprint) {
      requestData.requestFingerprint = params.requestFingerprint;
    }

    if (params.responseData) {
      requestData.responseData = params.responseData;
    }

    if (params.metadata !== undefined) {
      requestData.metadata = params.metadata;
    }

    const request = await this.prismaService.resolutionRequest.create({
      data: requestData,
      select: {
        id: true,
      },
    });

    if (params.lookup.flags.length > 0) {
      await this.prismaService.riskSignal.createMany({
        data: params.lookup.flags.map((flag) => ({
          resolutionRequestId: request.id,
          kind: flag,
          severity: params.lookup.riskLevel,
        })),
      });
    }

    return request;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private resolveLookupDirection(
    queryType: QueryType,
    metadata: Prisma.JsonValue | null | undefined,
  ): LookupDirection {
    const metadataDirection = readStringFromJsonObject(
      metadata,
      'lookupDirection',
    );

    if (isLookupDirection(metadataDirection)) {
      return metadataDirection;
    }

    switch (queryType) {
      case QueryType.CONFIRM_ADDRESS:
        return 'REVERSE_LOOKUP';
      case QueryType.VERIFY_ADDRESS:
        return 'TRANSFER_VERIFICATION';
      case QueryType.RESOLVE:
      case QueryType.BATCH_VERIFY:
      default:
        return 'FORWARD_LOOKUP';
    }
  }

  private readDisclosureMode(
    responseData: Prisma.JsonValue | null | undefined,
    metadata: Prisma.JsonValue | null | undefined,
  ): DisclosureMode {
    const responseDisclosureMode = readStringFromJsonObject(
      responseData,
      'disclosureMode',
    );

    if (isDisclosureMode(responseDisclosureMode)) {
      return responseDisclosureMode;
    }

    const metadataDisclosureMode = readStringFromJsonObject(
      metadata,
      'disclosureMode',
    );

    if (isDisclosureMode(metadataDisclosureMode)) {
      return metadataDisclosureMode;
    }

    return 'FULL_LABEL';
  }

  private readBatchLookupMode(value: string | undefined): BatchLookupMode {
    if (value === 'BY_ADDRESS' || value === 'MIXED') {
      return value;
    }

    return 'BY_RECIPIENT';
  }

  private resolveBatchRowLookupMode(
    batchLookupMode: BatchLookupMode,
    rowLookupMode?: string,
  ): BatchRowLookupMode {
    if (batchLookupMode === 'MIXED') {
      return rowLookupMode === 'BY_ADDRESS' ? 'BY_ADDRESS' : 'BY_RECIPIENT';
    }

    return batchLookupMode === 'BY_ADDRESS' ? 'BY_ADDRESS' : 'BY_RECIPIENT';
  }

  private assertBatchLookupRequirements(
    batchVerifyDto: BatchVerifyDto,
    lookupMode: BatchLookupMode,
  ) {
    for (const row of batchVerifyDto.rows) {
      const rowLookupMode = this.resolveBatchRowLookupMode(
        lookupMode,
        row.lookupMode,
      );

      if (
        rowLookupMode === 'BY_RECIPIENT' &&
        !row.recipientIdentifier?.trim()
      ) {
        throw new BadRequestException(
          'Recipient-based batch rows require a recipient identifier.',
        );
      }

      if (rowLookupMode === 'BY_ADDRESS' && !row.platform?.trim()) {
        throw new BadRequestException(
          'Address-based batch rows require a platform.',
        );
      }
    }
  }
}

function isResolveResponse(value: unknown): value is ResolveResponse {
  if (!isJsonObject(value)) {
    return false;
  }

  return (
    isLookupDirection(value.lookupDirection) &&
    isDisclosureMode(value.disclosureMode) &&
    isNullableString(value.recipientDisplayName) &&
    isNullableString(value.platform) &&
    isNullableString(value.address) &&
    isNullableString(value.chain) &&
    isNullableString(value.asset) &&
    typeof value.verified === 'boolean' &&
    isNullableString(value.expiresAt) &&
    isRiskLevel(value.riskLevel) &&
    isRiskSignalKindArray(value.flags) &&
    typeof value.recommendation === 'string'
  );
}

function isConfirmResponse(value: unknown): value is ConfirmResponse {
  if (!isJsonObject(value)) {
    return false;
  }

  return (
    isLookupDirection(value.lookupDirection) &&
    isDisclosureMode(value.disclosureMode) &&
    typeof value.confirmed === 'boolean' &&
    typeof value.verified === 'boolean' &&
    isNullableString(value.recipientDisplayName) &&
    isNullableString(value.platform) &&
    isNullableString(value.chain) &&
    isNullableString(value.asset) &&
    isNullableString(value.expiresAt) &&
    isRiskLevel(value.riskLevel) &&
    isRiskSignalKindArray(value.flags) &&
    typeof value.recommendation === 'string' &&
    (value.requiresPlatformSelection === undefined ||
      typeof value.requiresPlatformSelection === 'boolean') &&
    (value.candidatePlatforms === undefined ||
      isCandidatePlatformArray(value.candidatePlatforms))
  );
}

function isVerifyResponse(value: unknown): value is VerifyResponse {
  if (!isJsonObject(value)) {
    return false;
  }

  return (
    isLookupDirection(value.lookupDirection) &&
    isDisclosureMode(value.disclosureMode) &&
    typeof value.match === 'boolean' &&
    typeof value.verified === 'boolean' &&
    isNullableString(value.recipientDisplayName) &&
    isNullableString(value.platform) &&
    isRiskLevel(value.riskLevel) &&
    isRiskSignalKindArray(value.flags) &&
    typeof value.recommendation === 'string'
  );
}

function isJsonObject(
  value: unknown,
): value is Prisma.JsonObject & Record<string, Prisma.JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableString(value: Prisma.JsonValue | undefined): boolean {
  return value === null || typeof value === 'string';
}

function isDisclosureMode(value: unknown): value is DisclosureMode {
  return (
    value === 'FULL_LABEL' ||
    value === 'MASKED_LABEL' ||
    value === 'VERIFICATION_ONLY'
  );
}

function isLookupDirection(value: unknown): value is LookupDirection {
  return (
    value === 'FORWARD_LOOKUP' ||
    value === 'REVERSE_LOOKUP' ||
    value === 'TRANSFER_VERIFICATION'
  );
}

function isRiskLevel(value: Prisma.JsonValue | undefined): value is RiskLevel {
  return typeof value === 'string' && riskLevelValues.has(value);
}

function isRiskSignalKindArray(
  value: Prisma.JsonValue | undefined,
): value is RiskSignalKind[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item): item is RiskSignalKind =>
        typeof item === 'string' && riskSignalKindValues.has(item),
    )
  );
}

function isCandidatePlatformArray(
  value: Prisma.JsonValue | undefined,
): value is CandidatePlatform[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isJsonObject(item) &&
        typeof item.id === 'string' &&
        typeof item.slug === 'string' &&
        typeof item.displayName === 'string',
    )
  );
}

function readStringFromJsonObject(
  value: Prisma.JsonValue | null | undefined,
  key: string,
): string | null {
  if (!isJsonObject(value)) {
    return null;
  }

  const propertyValue = value[key];

  return typeof propertyValue === 'string' ? propertyValue : null;
}
