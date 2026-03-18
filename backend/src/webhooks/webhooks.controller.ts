import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedPartnerContext } from '../auth/authenticated-partner.decorator';
import type { AuthenticatedPartner } from '../auth/authenticated-partner.interface';
import { RequirePartnerAccessPolicy } from '../auth/partner-access-policy.decorator';
import { RequireCredentialScopes } from '../auth/credential-scopes.decorator';
import { PartnerApiKeyAuthGuard } from '../auth/partner-api-key-auth.guard';
import { apiResponse } from '../common/http/api-response';
import { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto';
import { ListWebhookDeliveriesDto } from './dto/list-webhook-deliveries.dto';
import { UpdateWebhookEndpointDto } from './dto/update-webhook-endpoint.dto';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
@UseGuards(PartnerApiKeyAuthGuard)
@RequirePartnerAccessPolicy({
  allCapabilities: ['webhooksEnabled'],
})
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  @RequireCredentialScopes('webhooks:read')
  async listWebhookEndpoints(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
  ) {
    const endpoints = await this.webhooksService.listWebhookEndpoints(
      authenticatedPartner.partnerId,
    );

    return apiResponse(endpoints);
  }

  @Get('deliveries')
  @RequireCredentialScopes('webhooks:read')
  async listWebhookDeliveries(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Query() listWebhookDeliveriesDto: ListWebhookDeliveriesDto,
  ) {
    const deliveries = await this.webhooksService.listWebhookDeliveries(
      authenticatedPartner.partnerId,
      {
        endpointId: listWebhookDeliveriesDto.endpointId?.trim(),
        eventType: listWebhookDeliveriesDto.eventType,
        limit: listWebhookDeliveriesDto.limit ?? 50,
        status: listWebhookDeliveriesDto.status,
      },
    );

    return apiResponse(deliveries);
  }

  @Get('deliveries/:deliveryId')
  @RequireCredentialScopes('webhooks:read')
  async getWebhookDelivery(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Param('deliveryId') deliveryId: string,
  ) {
    const delivery = await this.webhooksService.getWebhookDeliveryDetail(
      authenticatedPartner.partnerId,
      deliveryId.trim(),
    );

    if (!delivery) {
      throw new NotFoundException(
        'Webhook delivery was not found for the partner.',
      );
    }

    return apiResponse(delivery);
  }

  @Get(':endpointId')
  @RequireCredentialScopes('webhooks:read')
  async getWebhookEndpoint(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Param('endpointId') endpointId: string,
  ) {
    const endpoint = await this.webhooksService.getWebhookEndpointDetail(
      authenticatedPartner.partnerId,
      endpointId.trim(),
    );

    if (!endpoint) {
      throw new NotFoundException(
        'Webhook endpoint was not found for the partner.',
      );
    }

    return apiResponse(endpoint);
  }

  @Post()
  @RequireCredentialScopes('webhooks:write')
  async createWebhookEndpoint(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Body() createWebhookEndpointDto: CreateWebhookEndpointDto,
  ) {
    const endpoint = await this.webhooksService.createWebhookEndpoint(
      authenticatedPartner,
      createWebhookEndpointDto,
    );

    return apiResponse(endpoint);
  }

  @Patch(':endpointId')
  @RequireCredentialScopes('webhooks:write')
  async updateWebhookEndpoint(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Param('endpointId') endpointId: string,
    @Body() updateWebhookEndpointDto: UpdateWebhookEndpointDto,
  ) {
    const endpoint = await this.webhooksService.updateWebhookEndpoint(
      authenticatedPartner,
      endpointId,
      updateWebhookEndpointDto,
    );

    return apiResponse(endpoint);
  }

  @Post(':endpointId/rotate-secret')
  @RequireCredentialScopes('webhooks:write')
  async rotateWebhookSigningSecret(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Param('endpointId') endpointId: string,
  ) {
    const endpoint = await this.webhooksService.rotateWebhookSigningSecret(
      authenticatedPartner,
      endpointId,
    );

    return apiResponse(endpoint);
  }

  @Post(':endpointId/test')
  @RequireCredentialScopes('webhooks:write')
  async testWebhookEndpoint(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Param('endpointId') endpointId: string,
  ) {
    const result = await this.webhooksService.testWebhookEndpoint(
      authenticatedPartner,
      endpointId.trim(),
    );

    return apiResponse(result);
  }

  @Post('deliveries/:deliveryId/replay')
  @RequireCredentialScopes('webhooks:replay')
  async replayWebhookDelivery(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Param('deliveryId') deliveryId: string,
  ) {
    const delivery = await this.webhooksService.replayWebhookDelivery(
      authenticatedPartner,
      deliveryId.trim(),
    );

    return apiResponse(delivery);
  }

  @Delete(':endpointId')
  @RequireCredentialScopes('webhooks:write')
  async disableWebhookEndpoint(
    @AuthenticatedPartnerContext() authenticatedPartner: AuthenticatedPartner,
    @Param('endpointId') endpointId: string,
  ) {
    const endpoint = await this.webhooksService.disableWebhookEndpoint(
      authenticatedPartner,
      endpointId,
    );

    return apiResponse(endpoint);
  }
}
