import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
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
import { CreateRecipientDto } from './dto/create-recipient.dto';
import { ListRecipientsDto } from './dto/list-recipients.dto';
import { UpdateRecipientDto } from './dto/update-recipient.dto';
import { RecipientsService } from './recipients.service';

@Controller('recipients')
@UseGuards(PartnerApiKeyAuthGuard)
@RequirePartnerAccessPolicy({
  anyCapabilities: ['dataPartnerEnabled', 'fullAttestationPartnerEnabled'],
})
export class RecipientsController {
  constructor(private readonly recipientsService: RecipientsService) {}

  @Get()
  @RequireCredentialScopes('recipients:read')
  async listRecipients(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Query() listRecipientsDto: ListRecipientsDto,
  ) {
    const recipients = await this.recipientsService.listPartnerRecipients(
      authenticatedPartner.partnerId,
      {
        limit: listRecipientsDto.limit ?? 20,
        search: listRecipientsDto.search?.trim(),
        status: listRecipientsDto.status,
      },
    );

    return apiResponse(recipients);
  }

  @Post()
  @RequireCredentialScopes('recipients:write')
  @RequirePartnerAccessPolicy({
    minOnboardingStage: PartnerOnboardingStage.DATA_MAPPING_IN_PROGRESS,
  })
  async createRecipient(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Body() createRecipientDto: CreateRecipientDto,
  ) {
    const recipient = await this.recipientsService.createPartnerRecipient(
      authenticatedPartner.partnerId,
      createRecipientDto,
    );

    return apiResponse(recipient);
  }

  @Get(':recipientId')
  @RequireCredentialScopes('recipients:read')
  async getRecipient(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Param('recipientId') recipientId: string,
  ) {
    const recipient = await this.recipientsService.getPartnerRecipient(
      authenticatedPartner.partnerId,
      recipientId.trim(),
    );

    if (!recipient) {
      throw new NotFoundException('Recipient was not found for the partner.');
    }

    return apiResponse(recipient);
  }

  @Patch(':recipientId')
  @RequireCredentialScopes('recipients:write')
  @RequirePartnerAccessPolicy({
    minOnboardingStage: PartnerOnboardingStage.DATA_MAPPING_IN_PROGRESS,
  })
  async updateRecipient(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Param('recipientId') recipientId: string,
    @Body() updateRecipientDto: UpdateRecipientDto,
  ) {
    const recipient = await this.recipientsService.updatePartnerRecipient(
      authenticatedPartner.partnerId,
      recipientId.trim(),
      updateRecipientDto,
    );

    return apiResponse(recipient);
  }

  @Post(':recipientId/disable')
  @RequireCredentialScopes('recipients:write')
  @RequirePartnerAccessPolicy({
    minOnboardingStage: PartnerOnboardingStage.DATA_MAPPING_IN_PROGRESS,
  })
  async disableRecipient(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Param('recipientId') recipientId: string,
  ) {
    const recipient = await this.recipientsService.disablePartnerRecipient(
      authenticatedPartner.partnerId,
      recipientId.trim(),
    );

    return apiResponse(recipient);
  }
}
