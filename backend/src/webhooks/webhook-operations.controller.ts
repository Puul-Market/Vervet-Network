import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AdminTokenAuthGuard } from '../auth/admin-token-auth.guard';
import { apiResponse } from '../common/http/api-response';
import { ProcessWebhookDeliveriesDto } from './dto/process-webhook-deliveries.dto';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks/deliveries')
@UseGuards(AdminTokenAuthGuard)
export class WebhookOperationsController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('process')
  async processPendingDeliveries(
    @Body() processWebhookDeliveriesDto: ProcessWebhookDeliveriesDto,
  ) {
    const result = await this.webhooksService.processPendingDeliveries({
      limit: processWebhookDeliveriesDto.limit,
      ignoreSchedule: processWebhookDeliveriesDto.ignoreSchedule,
    });

    return apiResponse(result);
  }
}
