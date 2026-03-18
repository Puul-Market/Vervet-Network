import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthenticatedPartnerContext } from '../auth/authenticated-partner.decorator';
import type { AuthenticatedPartner } from '../auth/authenticated-partner.interface';
import { RequireCredentialScopes } from '../auth/credential-scopes.decorator';
import { PartnerApiKeyAuthGuard } from '../auth/partner-api-key-auth.guard';
import { apiResponse } from '../common/http/api-response';
import { OverviewService } from './overview.service';

@Controller('overview')
@UseGuards(PartnerApiKeyAuthGuard)
export class OverviewController {
  constructor(private readonly overviewService: OverviewService) {}

  @Get()
  @RequireCredentialScopes('partners:read')
  async getOverview(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
  ) {
    const overview = await this.overviewService.getPartnerOverview(
      authenticatedPartner.partnerId,
    );

    return apiResponse(overview);
  }
}
