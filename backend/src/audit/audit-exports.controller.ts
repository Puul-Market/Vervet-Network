import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PartnerUserRole } from '@prisma/client';
import { AuthenticatedPartnerContext } from '../auth/authenticated-partner.decorator';
import type { AuthenticatedPartner } from '../auth/authenticated-partner.interface';
import { RequirePartnerAccessPolicy } from '../auth/partner-access-policy.decorator';
import { RequireCredentialScopes } from '../auth/credential-scopes.decorator';
import { PartnerApiKeyAuthGuard } from '../auth/partner-api-key-auth.guard';
import { apiResponse } from '../common/http/api-response';
import { AuditService } from './audit.service';
import { CreateAuditExportDto } from './dto/create-audit-export.dto';

@Controller('audit-exports')
@UseGuards(PartnerApiKeyAuthGuard)
@RequirePartnerAccessPolicy({
  allCapabilities: ['auditExportsEnabled'],
  actorTypes: ['PARTNER_USER'],
  partnerUserRoles: [PartnerUserRole.OWNER, PartnerUserRole.ADMIN],
})
export class AuditExportsController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequireCredentialScopes('audit:export')
  async listAuditExports(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
  ) {
    const exports = await this.auditService.listPartnerAuditExports(
      authenticatedPartner.partnerId,
    );

    return apiResponse(exports);
  }

  @Get(':exportId')
  @RequireCredentialScopes('audit:export')
  async getAuditExport(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Param('exportId') exportId: string,
  ) {
    const auditExport = await this.auditService.getAuditExportDownload(
      authenticatedPartner.partnerId,
      exportId.trim(),
    );

    return apiResponse(auditExport);
  }

  @Post()
  @RequireCredentialScopes('audit:export')
  async createAuditExport(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Body() createAuditExportDto: CreateAuditExportDto,
  ) {
    const auditExport = await this.auditService.createAuditExport(
      authenticatedPartner.partnerId,
      authenticatedPartner.partnerUserId,
      createAuditExportDto,
    );

    return apiResponse(auditExport);
  }
}
