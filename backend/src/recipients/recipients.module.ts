import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NormalizationModule } from '../common/normalization/normalization.module';
import { PartnersModule } from '../partners/partners.module';
import { RecipientsController } from './recipients.controller';
import { RecipientsService } from './recipients.service';

@Module({
  imports: [AuthModule, NormalizationModule, PartnersModule],
  controllers: [RecipientsController],
  providers: [RecipientsService],
  exports: [RecipientsService],
})
export class RecipientsModule {}
