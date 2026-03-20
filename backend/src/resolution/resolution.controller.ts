import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedPartnerContext } from '../auth/authenticated-partner.decorator';
import type { AuthenticatedPartner } from '../auth/authenticated-partner.interface';
import { RequirePartnerAccessPolicy } from '../auth/partner-access-policy.decorator';
import { RequireCredentialScopes } from '../auth/credential-scopes.decorator';
import { PartnerApiKeyAuthGuard } from '../auth/partner-api-key-auth.guard';
import { apiResponse } from '../common/http/api-response';
import { BatchVerifyDto } from './dto/batch-verify.dto';
import { ConfirmRecipientDto } from './dto/confirm-recipient.dto';
import { ListResolutionLogsDto } from './dto/list-resolution-logs.dto';
import { ResolveRecipientDto } from './dto/resolve-recipient.dto';
import { VerifyDestinationDto } from './dto/verify-destination.dto';
import { ResolutionService } from './resolution.service';

@Controller('resolution')
@UseGuards(PartnerApiKeyAuthGuard)
@RequirePartnerAccessPolicy({
  anyCapabilities: [
    'apiConsumerEnabled',
    'dataPartnerEnabled',
    'fullAttestationPartnerEnabled',
  ],
})
export class ResolutionController {
  constructor(private readonly resolutionService: ResolutionService) {}

  @Get('logs')
  @RequireCredentialScopes('resolution:read')
  async listResolutionLogs(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Query() listResolutionLogsDto: ListResolutionLogsDto,
  ) {
    const logs = await this.resolutionService.listResolutionLogs(
      authenticatedPartner.partnerId,
      {
        asset: listResolutionLogsDto.asset?.trim(),
        chain: listResolutionLogsDto.chain?.trim(),
        limit: listResolutionLogsDto.limit ?? 50,
        outcome: listResolutionLogsDto.outcome,
        platform: listResolutionLogsDto.platform?.trim(),
        queryType: listResolutionLogsDto.queryType,
        recipientIdentifier: listResolutionLogsDto.recipientIdentifier?.trim(),
        riskLevel: listResolutionLogsDto.riskLevel,
      },
    );

    return apiResponse(logs);
  }

  @Get('logs/:requestId')
  @RequireCredentialScopes('resolution:read')
  async getResolutionLog(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Param('requestId') requestId: string,
  ) {
    const log = await this.resolutionService.getResolutionLog(
      authenticatedPartner.partnerId,
      requestId.trim(),
    );

    if (!log) {
      throw new NotFoundException(
        'Resolution log was not found for the partner.',
      );
    }

    return apiResponse(log);
  }

  @Post('resolve')
  @RequireCredentialScopes('resolution:read')
  @RequirePartnerAccessPolicy({
    requireOperationalEnvironment: true,
  })
  async resolveRecipient(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() resolveRecipientDto: ResolveRecipientDto,
  ) {
    const result = await this.resolutionService.resolve(resolveRecipientDto, {
      authenticatedPartner,
      idempotencyKey: this.normalizeIdempotencyKey(idempotencyKey),
    });

    return apiResponse(result);
  }

  @Post('by-recipient')
  @RequireCredentialScopes('resolution:read')
  @RequirePartnerAccessPolicy({
    requireOperationalEnvironment: true,
  })
  async resolveRecipientByRoute(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() resolveRecipientDto: ResolveRecipientDto,
  ) {
    const result = await this.resolutionService.resolve(resolveRecipientDto, {
      authenticatedPartner,
      idempotencyKey: this.normalizeIdempotencyKey(idempotencyKey),
    });

    return apiResponse(result);
  }

  @Post('by-address')
  @RequireCredentialScopes('resolution:read')
  @RequirePartnerAccessPolicy({
    requireOperationalEnvironment: true,
  })
  async confirmRecipientByAddress(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() confirmRecipientDto: ConfirmRecipientDto,
  ) {
    const result = await this.resolutionService.confirmAddress(
      confirmRecipientDto,
      {
        authenticatedPartner,
        idempotencyKey: this.normalizeIdempotencyKey(idempotencyKey),
      },
    );

    return apiResponse(result);
  }

  @Post('verify')
  @RequireCredentialScopes('resolution:read')
  @RequirePartnerAccessPolicy({
    requireOperationalEnvironment: true,
  })
  async verifyDestination(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() verifyDestinationDto: VerifyDestinationDto,
  ) {
    const result = await this.resolutionService.verify(verifyDestinationDto, {
      authenticatedPartner,
      idempotencyKey: this.normalizeIdempotencyKey(idempotencyKey),
    });

    return apiResponse(result);
  }

  @Post('verify-transfer')
  @RequireCredentialScopes('resolution:read')
  @RequirePartnerAccessPolicy({
    requireOperationalEnvironment: true,
  })
  async verifyTransfer(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() verifyDestinationDto: VerifyDestinationDto,
  ) {
    const result = await this.resolutionService.verify(verifyDestinationDto, {
      authenticatedPartner,
      idempotencyKey: this.normalizeIdempotencyKey(idempotencyKey),
    });

    return apiResponse(result);
  }

  @Post('batch')
  @RequireCredentialScopes('resolution:batch')
  @RequirePartnerAccessPolicy({
    allCapabilities: ['batchVerificationEnabled'],
    allPlanEntitlements: ['bulkVerificationEnabled'],
    requireOperationalEnvironment: true,
  })
  async batchVerify(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Body() batchVerifyDto: BatchVerifyDto,
  ) {
    const result = await this.resolutionService.batchVerify(batchVerifyDto, {
      authenticatedPartner,
      idempotencyKey: null,
    });

    return apiResponse(result);
  }

  private normalizeIdempotencyKey(value: string | undefined): string | null {
    if (value === undefined) {
      return null;
    }

    const normalizedValue = value.trim();

    if (normalizedValue.length === 0) {
      return null;
    }

    if (normalizedValue.length > 200) {
      throw new BadRequestException('Idempotency-Key header is too long.');
    }

    return normalizedValue;
  }
}
