import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedPartnerContext } from '../auth/authenticated-partner.decorator';
import { PartnerApiKeyAuthGuard } from '../auth/partner-api-key-auth.guard';
import type { AuthenticatedPartner } from '../auth/authenticated-partner.interface';
import { apiResponse } from '../common/http/api-response';
import { AcceptPartnerUserInviteDto } from './dto/accept-partner-user-invite.dto';
import { DashboardLoginDto } from './dto/dashboard-login.dto';
import { PartnersService } from './partners.service';

@Controller('dashboard-auth')
export class PartnerDashboardAuthController {
  constructor(private readonly partnersService: PartnersService) {}

  @Post('login')
  async login(@Body() dashboardLoginDto: DashboardLoginDto) {
    const session =
      await this.partnersService.loginDashboardUser(dashboardLoginDto);

    return apiResponse(session);
  }

  @Post('invitations/:inviteToken/accept')
  async acceptInvite(
    @Param('inviteToken') inviteToken: string,
    @Body() acceptPartnerUserInviteDto: AcceptPartnerUserInviteDto,
  ) {
    const session = await this.partnersService.acceptPartnerUserInvite(
      inviteToken.trim(),
      acceptPartnerUserInviteDto,
    );

    return apiResponse(session);
  }

  @Post('logout')
  @UseGuards(PartnerApiKeyAuthGuard)
  async logout(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
  ) {
    const result =
      await this.partnersService.logoutDashboardSession(authenticatedPartner);

    return apiResponse(result);
  }
}
