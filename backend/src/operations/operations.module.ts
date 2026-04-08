import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ResolutionModule } from '../resolution/resolution.module';
import { RequestHardeningModule } from '../security/request-hardening.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { WebhookDeliveryProcessorService } from './webhook-delivery-processor.service';

@Module({
  imports: [
    AuditModule,
    WebhooksModule,
    RequestHardeningModule,
    ResolutionModule,
  ],
  providers: [WebhookDeliveryProcessorService],
})
export class OperationsModule {}
