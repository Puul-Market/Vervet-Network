import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { NormalizationModule } from '../common/normalization/normalization.module';
import { EncryptedSubmissionModule } from '../common/security/encrypted-submission.module';
import { PartnersModule } from '../partners/partners.module';
import { RecipientsModule } from '../recipients/recipients.module';
import { RequestHardeningModule } from '../security/request-hardening.module';
import { ResolutionController } from './resolution.controller';
import { ResolutionService } from './resolution.service';

@Module({
  imports: [
    AuditModule,
    AuthModule,
    EncryptedSubmissionModule,
    NormalizationModule,
    PartnersModule,
    RecipientsModule,
    RequestHardeningModule,
  ],
  controllers: [ResolutionController],
  providers: [ResolutionService],
  exports: [ResolutionService],
})
export class ResolutionModule {}
