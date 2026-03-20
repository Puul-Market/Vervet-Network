import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PartnerUserRole } from '@prisma/client';
import { AuthenticatedPartnerContext } from '../auth/authenticated-partner.decorator';
import type { AuthenticatedPartner } from '../auth/authenticated-partner.interface';
import { RequirePartnerAccessPolicy } from '../auth/partner-access-policy.decorator';
import { RequireCredentialScopes } from '../auth/credential-scopes.decorator';
import { PartnerApiKeyAuthGuard } from '../auth/partner-api-key-auth.guard';
import { apiResponse } from '../common/http/api-response';
import { CreatePartnerUserInviteDto } from './dto/create-partner-user-invite.dto';
import { CreateSelfServiceApiCredentialDto } from './dto/create-self-service-api-credential.dto';
import { DashboardMetadataService } from './dashboard-metadata.service';
import { RequestProductionApprovalDto } from './dto/request-production-approval.dto';
import { RegisterSelfServiceSigningKeyDto } from './dto/register-self-service-signing-key.dto';
import { UpdatePartnerSecuritySettingsDto } from './dto/update-partner-security-settings.dto';
import { UpdatePartnerUserDto } from './dto/update-partner-user.dto';
import { PartnersService } from './partners.service';

@Controller('partners/me')
@UseGuards(PartnerApiKeyAuthGuard)
export class PartnerAccountController {
  constructor(
    private readonly partnersService: PartnersService,
    private readonly dashboardMetadataService: DashboardMetadataService,
  ) {}

  @Get()
  @RequireCredentialScopes('partners:read')
  async getPartnerProfile(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
  ) {
    const profile =
      await this.partnersService.getPartnerProfile(authenticatedPartner);

    return apiResponse(profile);
  }

  @Get('dashboard-metadata')
  @RequireCredentialScopes('partners:read')
  async getDashboardMetadata(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
  ) {
    const metadata =
      await this.dashboardMetadataService.getPartnerDashboardMetadata(
        authenticatedPartner,
      );

    return apiResponse(metadata);
  }

  @Get('plan-usage')
  @RequireCredentialScopes('partners:read')
  async getPartnerPlanUsage(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
  ) {
    const planUsage =
      await this.partnersService.getPartnerPlanUsage(authenticatedPartner);

    return apiResponse(planUsage);
  }

  @Get('api-credentials')
  @RequireCredentialScopes('partners:read')
  @RequirePartnerAccessPolicy({
    anyCapabilities: [
      'apiConsumerEnabled',
      'dataPartnerEnabled',
      'fullAttestationPartnerEnabled',
    ],
    partnerUserRoles: [
      PartnerUserRole.OWNER,
      PartnerUserRole.ADMIN,
      PartnerUserRole.DEVELOPER,
    ],
  })
  async listApiCredentials(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
  ) {
    const credentials =
      await this.partnersService.listPartnerApiCredentials(
        authenticatedPartner,
      );

    return apiResponse(credentials);
  }

  @Post('api-credentials')
  @RequireCredentialScopes('partners:write')
  @RequirePartnerAccessPolicy({
    anyCapabilities: [
      'apiConsumerEnabled',
      'dataPartnerEnabled',
      'fullAttestationPartnerEnabled',
    ],
    partnerUserRoles: [
      PartnerUserRole.OWNER,
      PartnerUserRole.ADMIN,
      PartnerUserRole.DEVELOPER,
    ],
  })
  async createApiCredential(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Body() createApiCredentialDto: CreateSelfServiceApiCredentialDto,
  ) {
    const credential = await this.partnersService.issuePartnerApiCredential(
      authenticatedPartner,
      createApiCredentialDto,
    );

    return apiResponse(credential);
  }

  @Post('api-credentials/:credentialId/revoke')
  @RequireCredentialScopes('partners:write')
  @RequirePartnerAccessPolicy({
    anyCapabilities: [
      'apiConsumerEnabled',
      'dataPartnerEnabled',
      'fullAttestationPartnerEnabled',
    ],
    partnerUserRoles: [
      PartnerUserRole.OWNER,
      PartnerUserRole.ADMIN,
      PartnerUserRole.DEVELOPER,
    ],
  })
  async revokeApiCredential(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Param('credentialId') credentialId: string,
  ) {
    const credential = await this.partnersService.revokePartnerApiCredential(
      authenticatedPartner,
      credentialId,
    );

    return apiResponse(credential);
  }

  @Get('signing-keys')
  @RequireCredentialScopes('partners:read')
  @RequirePartnerAccessPolicy({
    anyCapabilities: ['dataPartnerEnabled', 'fullAttestationPartnerEnabled'],
    partnerUserRoles: [
      PartnerUserRole.OWNER,
      PartnerUserRole.ADMIN,
      PartnerUserRole.DEVELOPER,
    ],
  })
  async listSigningKeys(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
  ) {
    const signingKeys = await this.partnersService.listPartnerSigningKeys(
      authenticatedPartner.partnerId,
    );

    return apiResponse(signingKeys);
  }

  @Post('signing-keys')
  @RequireCredentialScopes('partners:write')
  @RequirePartnerAccessPolicy({
    anyCapabilities: ['dataPartnerEnabled', 'fullAttestationPartnerEnabled'],
    partnerUserRoles: [
      PartnerUserRole.OWNER,
      PartnerUserRole.ADMIN,
      PartnerUserRole.DEVELOPER,
    ],
  })
  async registerSigningKey(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Body() registerSigningKeyDto: RegisterSelfServiceSigningKeyDto,
  ) {
    const signingKey = await this.partnersService.registerPartnerSigningKey(
      authenticatedPartner,
      registerSigningKeyDto,
    );

    return apiResponse(signingKey);
  }

  @Post('signing-keys/:signingKeyId/revoke')
  @RequireCredentialScopes('partners:write')
  @RequirePartnerAccessPolicy({
    anyCapabilities: ['dataPartnerEnabled', 'fullAttestationPartnerEnabled'],
    partnerUserRoles: [
      PartnerUserRole.OWNER,
      PartnerUserRole.ADMIN,
      PartnerUserRole.DEVELOPER,
    ],
  })
  async revokeSigningKey(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Param('signingKeyId') signingKeyId: string,
  ) {
    const signingKey = await this.partnersService.revokePartnerSigningKey(
      authenticatedPartner,
      signingKeyId,
    );

    return apiResponse(signingKey);
  }

  @Get('users')
  @RequireCredentialScopes('team:read')
  @RequirePartnerAccessPolicy({
    actorTypes: ['PARTNER_USER'],
    partnerUserRoles: [PartnerUserRole.OWNER, PartnerUserRole.ADMIN],
  })
  async listPartnerUsers(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
  ) {
    const result =
      await this.partnersService.listPartnerUsers(authenticatedPartner);

    return apiResponse(result);
  }

  @Post('users/invites')
  @RequireCredentialScopes('team:write')
  @RequirePartnerAccessPolicy({
    actorTypes: ['PARTNER_USER'],
    partnerUserRoles: [PartnerUserRole.OWNER, PartnerUserRole.ADMIN],
  })
  async invitePartnerUser(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Body() createPartnerUserInviteDto: CreatePartnerUserInviteDto,
  ) {
    const invite = await this.partnersService.invitePartnerUser(
      authenticatedPartner,
      createPartnerUserInviteDto,
    );

    return apiResponse(invite);
  }

  @Patch('users/:userId')
  @RequireCredentialScopes('team:write')
  @RequirePartnerAccessPolicy({
    actorTypes: ['PARTNER_USER'],
    partnerUserRoles: [PartnerUserRole.OWNER, PartnerUserRole.ADMIN],
  })
  async updatePartnerUser(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Param('userId') userId: string,
    @Body() updatePartnerUserDto: UpdatePartnerUserDto,
  ) {
    const user = await this.partnersService.updatePartnerUser(
      authenticatedPartner,
      userId,
      updatePartnerUserDto,
    );

    return apiResponse(user);
  }

  @Post('users/:userId/deactivate')
  @RequireCredentialScopes('team:write')
  @RequirePartnerAccessPolicy({
    actorTypes: ['PARTNER_USER'],
    partnerUserRoles: [PartnerUserRole.OWNER, PartnerUserRole.ADMIN],
  })
  async deactivatePartnerUser(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Param('userId') userId: string,
  ) {
    const user = await this.partnersService.deactivatePartnerUser(
      authenticatedPartner,
      userId,
    );

    return apiResponse(user);
  }

  @Get('security-settings')
  @RequireCredentialScopes('security:read')
  @RequirePartnerAccessPolicy({
    actorTypes: ['PARTNER_USER'],
    partnerUserRoles: [PartnerUserRole.OWNER, PartnerUserRole.ADMIN],
  })
  async getSecuritySettings(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
  ) {
    const settings = await this.partnersService.getPartnerSecuritySettings(
      authenticatedPartner.partnerId,
    );

    return apiResponse(settings);
  }

  @Patch('security-settings')
  @RequireCredentialScopes('security:write')
  @RequirePartnerAccessPolicy({
    actorTypes: ['PARTNER_USER'],
    partnerUserRoles: [PartnerUserRole.OWNER],
  })
  async updateSecuritySettings(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Body() updatePartnerSecuritySettingsDto: UpdatePartnerSecuritySettingsDto,
  ) {
    const settings = await this.partnersService.updatePartnerSecuritySettings(
      authenticatedPartner,
      updatePartnerSecuritySettingsDto,
    );

    return apiResponse(settings);
  }

  @Get('production-approval-requests')
  @RequireCredentialScopes('partners:read')
  @RequirePartnerAccessPolicy({
    actorTypes: ['PARTNER_USER'],
  })
  async listProductionApprovalRequests(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
  ) {
    const requests =
      await this.partnersService.listProductionApprovalRequests(
        authenticatedPartner,
      );

    return apiResponse(requests);
  }

  @Get('production-corridors')
  @RequireCredentialScopes('partners:read')
  @RequirePartnerAccessPolicy({
    actorTypes: ['PARTNER_USER'],
  })
  async listProductionCorridors(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
  ) {
    const corridors =
      await this.partnersService.listPartnerProductionCorridors(
        authenticatedPartner,
      );

    return apiResponse(corridors);
  }

  @Get('available-production-corridors')
  @RequireCredentialScopes('partners:read')
  @RequirePartnerAccessPolicy({
    actorTypes: ['PARTNER_USER'],
  })
  async listAvailableProductionCorridors(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
  ) {
    const corridors =
      await this.partnersService.listPartnerAvailableProductionCorridors(
        authenticatedPartner,
      );

    return apiResponse(corridors);
  }

  @Post('production-approval-requests')
  @RequireCredentialScopes('partners:write')
  @RequirePartnerAccessPolicy({
    actorTypes: ['PARTNER_USER'],
    partnerUserRoles: [PartnerUserRole.OWNER, PartnerUserRole.ADMIN],
  })
  async requestProductionApproval(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Body() requestProductionApprovalDto: RequestProductionApprovalDto,
  ) {
    const productionApprovalRequest =
      await this.partnersService.requestProductionApproval(
        authenticatedPartner,
        requestProductionApprovalDto,
      );

    return apiResponse(productionApprovalRequest);
  }

  @Post('production-approval-requests/:requestId/cancel')
  @RequireCredentialScopes('partners:write')
  @RequirePartnerAccessPolicy({
    actorTypes: ['PARTNER_USER'],
    partnerUserRoles: [PartnerUserRole.OWNER, PartnerUserRole.ADMIN],
  })
  async cancelProductionApprovalRequest(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Param('requestId') requestId: string,
  ) {
    const productionApprovalRequest =
      await this.partnersService.cancelProductionApprovalRequest(
        authenticatedPartner,
        requestId,
      );

    return apiResponse(productionApprovalRequest);
  }
}
