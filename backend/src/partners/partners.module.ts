import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { NormalizationModule } from '../common/normalization/normalization.module';
import { DashboardMetadataService } from './dashboard-metadata.service';
import { PartnerAccountController } from './partner-account.controller';
import { PartnerDashboardAuthController } from './partner-dashboard-auth.controller';
import { PartnersController } from './partners.controller';
import { PartnersService } from './partners.service';

@Module({
  imports: [AuditModule, forwardRef(() => AuthModule), NormalizationModule],
  controllers: [
    PartnerAccountController,
    PartnerDashboardAuthController,
    PartnersController,
  ],
  providers: [PartnersService, DashboardMetadataService],
  exports: [PartnersService, DashboardMetadataService],
})
export class PartnersModule {}
