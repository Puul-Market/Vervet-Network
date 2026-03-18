import {
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
import { PartnerOnboardingStage } from '@prisma/client';
import { AuthenticatedPartnerContext } from '../auth/authenticated-partner.decorator';
import type { AuthenticatedPartner } from '../auth/authenticated-partner.interface';
import { RequirePartnerAccessPolicy } from '../auth/partner-access-policy.decorator';
import { RequireCredentialScopes } from '../auth/credential-scopes.decorator';
import { PartnerApiKeyAuthGuard } from '../auth/partner-api-key-auth.guard';
import { apiResponse } from '../common/http/api-response';
import { AttestationsService } from './attestations.service';
import { CreateAttestationDto } from './dto/create-attestation.dto';
import { ListAttestationsDto } from './dto/list-attestations.dto';

@Controller('attestations')
export class AttestationsController {
  constructor(private readonly attestationsService: AttestationsService) {}

  @Get()
  @UseGuards(PartnerApiKeyAuthGuard)
  @RequireCredentialScopes('attestations:read')
  @RequirePartnerAccessPolicy({
    anyCapabilities: ['dataPartnerEnabled', 'fullAttestationPartnerEnabled'],
  })
  async listAttestations(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Query() listAttestationsDto: ListAttestationsDto,
  ) {
    const attestations = await this.attestationsService.listPartnerAttestations(
      authenticatedPartner.partnerId,
      {
        asset: listAttestationsDto.asset?.trim(),
        attestationType: listAttestationsDto.attestationType,
        chain: listAttestationsDto.chain?.trim(),
        limit: listAttestationsDto.limit ?? 20,
        recipientId: listAttestationsDto.recipientId?.trim(),
        recipientIdentifier: listAttestationsDto.recipientIdentifier?.trim(),
        verificationStatus: listAttestationsDto.verificationStatus,
      },
    );

    return apiResponse(attestations);
  }

  @Get(':attestationId')
  @UseGuards(PartnerApiKeyAuthGuard)
  @RequireCredentialScopes('attestations:read')
  @RequirePartnerAccessPolicy({
    anyCapabilities: ['dataPartnerEnabled', 'fullAttestationPartnerEnabled'],
  })
  async getAttestation(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Param('attestationId') attestationId: string,
  ) {
    const attestation = await this.attestationsService.getPartnerAttestation(
      authenticatedPartner.partnerId,
      attestationId.trim(),
    );

    if (!attestation) {
      throw new NotFoundException('Attestation was not found for the partner.');
    }

    return apiResponse(attestation);
  }

  @Post()
  @UseGuards(PartnerApiKeyAuthGuard)
  @RequireCredentialScopes('attestations:write')
  @RequirePartnerAccessPolicy({
    allCapabilities: ['fullAttestationPartnerEnabled'],
    minOnboardingStage: PartnerOnboardingStage.DATA_MAPPING_IN_PROGRESS,
  })
  async createAttestation(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Headers('x-request-nonce') requestNonce: string | undefined,
    @Headers('x-request-timestamp') requestTimestamp: string | undefined,
    @Body() createAttestationDto: CreateAttestationDto,
  ) {
    const attestation = await this.attestationsService.createAttestation(
      createAttestationDto,
      authenticatedPartner,
      {
        requestNonce,
        requestTimestamp,
      },
    );

    return apiResponse(attestation);
  }
}
