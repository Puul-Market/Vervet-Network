import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PartnersModule } from '../partners/partners.module';
import { WebhookOperationsController } from './webhook-operations.controller';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [AuditModule, AuthModule, PartnersModule],
  controllers: [WebhookOperationsController, WebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
