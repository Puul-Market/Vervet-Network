import { Module, forwardRef } from '@nestjs/common';
import { PartnersModule } from '../partners/partners.module';
import { AdminTokenAuthGuard } from './admin-token-auth.guard';
import { PartnerApiKeyAuthGuard } from './partner-api-key-auth.guard';

@Module({
  imports: [forwardRef(() => PartnersModule)],
  providers: [AdminTokenAuthGuard, PartnerApiKeyAuthGuard],
  exports: [AdminTokenAuthGuard, PartnerApiKeyAuthGuard],
})
export class AuthModule {}
