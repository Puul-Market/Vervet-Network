import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { NormalizationModule } from '../common/normalization/normalization.module';
import { EncryptedSubmissionModule } from '../common/security/encrypted-submission.module';
import { PartnersModule } from '../partners/partners.module';
import { RecipientsModule } from '../recipients/recipients.module';
import { RequestHardeningModule } from '../security/request-hardening.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { AttestationsController } from './attestations.controller';
import { AttestationsService } from './attestations.service';

@Module({
  imports: [
    AuditModule,
    AuthModule,
    EncryptedSubmissionModule,
    NormalizationModule,
    PartnersModule,
    RecipientsModule,
    RequestHardeningModule,
    WebhooksModule,
  ],
  controllers: [AttestationsController],
  providers: [AttestationsService],
  exports: [AttestationsService],
})
export class AttestationsModule {}
