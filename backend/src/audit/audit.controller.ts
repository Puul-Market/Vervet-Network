import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedPartnerContext } from '../auth/authenticated-partner.decorator';
import type { AuthenticatedPartner } from '../auth/authenticated-partner.interface';
import { RequireCredentialScopes } from '../auth/credential-scopes.decorator';
import { PartnerApiKeyAuthGuard } from '../auth/partner-api-key-auth.guard';
import { apiResponse } from '../common/http/api-response';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';
import { AuditService } from './audit.service';

@Controller('audit-logs')
@UseGuards(PartnerApiKeyAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequireCredentialScopes('audit:read')
  async listAuditLogs(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Query() listAuditLogsDto: ListAuditLogsDto,
  ) {
    const auditLogs = await this.auditService.listPartnerAuditLogs(
      authenticatedPartner.partnerId,
      {
        action: listAuditLogsDto.action?.trim(),
        actorType: listAuditLogsDto.actorType,
        entityId: listAuditLogsDto.entityId?.trim(),
        entityType: listAuditLogsDto.entityType?.trim(),
        limit: listAuditLogsDto.limit ?? 50,
      },
    );

    return apiResponse(auditLogs);
  }
  @Get(':eventId')
  @RequireCredentialScopes('audit:read')
  async getAuditLog(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Param('eventId') eventId: string,
  ) {
    const auditLog = await this.auditService.getPartnerAuditLog(
      authenticatedPartner.partnerId,
      eventId.trim(),
    );

    if (!auditLog) {
      throw new NotFoundException(
        'Audit log event was not found for the partner.',
      );
    }

    return apiResponse(auditLog);
  }
}
