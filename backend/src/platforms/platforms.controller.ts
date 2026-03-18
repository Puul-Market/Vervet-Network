import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RequirePartnerAccessPolicy } from '../auth/partner-access-policy.decorator';
import { RequireCredentialScopes } from '../auth/credential-scopes.decorator';
import { PartnerApiKeyAuthGuard } from '../auth/partner-api-key-auth.guard';
import { apiResponse } from '../common/http/api-response';
import { ListSupportedPlatformsDto } from './dto/list-supported-platforms.dto';
import { PlatformsService } from './platforms.service';

@Controller('platforms')
@UseGuards(PartnerApiKeyAuthGuard)
export class PlatformsController {
  constructor(private readonly platformsService: PlatformsService) {}

  @Get()
  @RequireCredentialScopes('resolution:read')
  @RequirePartnerAccessPolicy({
    anyCapabilities: [
      'apiConsumerEnabled',
      'dataPartnerEnabled',
      'fullAttestationPartnerEnabled',
    ],
    requireOperationalEnvironment: true,
  })
  async listPlatforms(
    @Query() listSupportedPlatformsDto: ListSupportedPlatformsDto,
  ) {
    const platforms = await this.platformsService.listSupportedPlatforms({
      address: listSupportedPlatformsDto.address?.trim(),
      asset: listSupportedPlatformsDto.asset?.trim(),
      chain: listSupportedPlatformsDto.chain?.trim(),
      lookupMode: listSupportedPlatformsDto.lookupMode,
    });

    return apiResponse(platforms);
  }
}
