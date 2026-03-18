import {
  Body,
  Controller,
  Get,
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
import { CreateDestinationDto } from './dto/create-destination.dto';
import { ListDestinationsDto } from './dto/list-destinations.dto';
import { ReplaceDestinationDto } from './dto/replace-destination.dto';
import { DestinationsService } from './destinations.service';

@Controller('destinations')
@UseGuards(PartnerApiKeyAuthGuard)
@RequirePartnerAccessPolicy({
  anyCapabilities: ['dataPartnerEnabled', 'fullAttestationPartnerEnabled'],
})
export class DestinationsController {
  constructor(private readonly destinationsService: DestinationsService) {}

  @Get()
  @RequireCredentialScopes('destinations:read')
  async listDestinations(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Query() listDestinationsDto: ListDestinationsDto,
  ) {
    const destinations = await this.destinationsService.listPartnerDestinations(
      authenticatedPartner.partnerId,
      listDestinationsDto,
    );

    return apiResponse(destinations);
  }

  @Get(':destinationId')
  @RequireCredentialScopes('destinations:read')
  async getDestination(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Param('destinationId') destinationId: string,
  ) {
    const destination = await this.destinationsService.getPartnerDestination(
      authenticatedPartner.partnerId,
      destinationId.trim(),
    );

    if (!destination) {
      throw new NotFoundException('Destination was not found for the partner.');
    }

    return apiResponse(destination);
  }

  @Post()
  @RequireCredentialScopes('destinations:write')
  @RequirePartnerAccessPolicy({
    minOnboardingStage: PartnerOnboardingStage.DATA_MAPPING_IN_PROGRESS,
  })
  async createDestination(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Body() createDestinationDto: CreateDestinationDto,
  ) {
    const destination = await this.destinationsService.createPartnerDestination(
      authenticatedPartner.partnerId,
      createDestinationDto,
    );

    return apiResponse(destination);
  }

  @Post(':destinationId/revoke')
  @RequireCredentialScopes('destinations:write')
  @RequirePartnerAccessPolicy({
    minOnboardingStage: PartnerOnboardingStage.DATA_MAPPING_IN_PROGRESS,
  })
  async revokeDestination(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Param('destinationId') destinationId: string,
  ) {
    const destination = await this.destinationsService.revokePartnerDestination(
      authenticatedPartner.partnerId,
      destinationId.trim(),
    );

    return apiResponse(destination);
  }

  @Post(':destinationId/replace')
  @RequireCredentialScopes('destinations:write')
  @RequirePartnerAccessPolicy({
    minOnboardingStage: PartnerOnboardingStage.DATA_MAPPING_IN_PROGRESS,
  })
  async replaceDestination(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Param('destinationId') destinationId: string,
    @Body() replaceDestinationDto: ReplaceDestinationDto,
  ) {
    const destination =
      await this.destinationsService.replacePartnerDestination(
        authenticatedPartner.partnerId,
        destinationId.trim(),
        replaceDestinationDto,
      );

    return apiResponse(destination);
  }
}
