import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthenticatedPartnerContext } from '../auth/authenticated-partner.decorator';
import type { AuthenticatedPartner } from '../auth/authenticated-partner.interface';
import { RequirePartnerAccessPolicy } from '../auth/partner-access-policy.decorator';
import { RequireCredentialScopes } from '../auth/credential-scopes.decorator';
import { PartnerApiKeyAuthGuard } from '../auth/partner-api-key-auth.guard';
import { apiResponse } from '../common/http/api-response';
import { DataFeedHealthService } from './data-feed-health.service';

@Controller('data-feed-health')
@UseGuards(PartnerApiKeyAuthGuard)
@RequirePartnerAccessPolicy({
  anyCapabilities: ['dataPartnerEnabled', 'fullAttestationPartnerEnabled'],
})
export class DataFeedHealthController {
  constructor(private readonly dataFeedHealthService: DataFeedHealthService) {}

  @Get()
  @RequireCredentialScopes('partners:read')
  async getDataFeedHealth(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
  ) {
    const dataFeedHealth =
      await this.dataFeedHealthService.getPartnerDataFeedHealth(
        authenticatedPartner.partnerId,
      );

    return apiResponse(dataFeedHealth);
  }
}
