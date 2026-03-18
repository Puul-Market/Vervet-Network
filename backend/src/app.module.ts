import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditApiModule } from './audit/audit-api.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { AttestationsModule } from './attestations/attestations.module';
import { validateEnvironment } from './config/environment';
import { DataFeedHealthModule } from './data-feed-health/data-feed-health.module';
import { HealthModule } from './health/health.module';
import { OverviewModule } from './overview/overview.module';
import { OperationsModule } from './operations/operations.module';
import { PartnersModule } from './partners/partners.module';
import { PlatformsModule } from './platforms/platforms.module';
import { PrismaModule } from './prisma/prisma.module';
import { RecipientsModule } from './recipients/recipients.module';
import { ResolutionModule } from './resolution/resolution.module';
import { DestinationsModule } from './destinations/destinations.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    AuditApiModule,
    AuditModule,
    AuthModule,
    PrismaModule,
    HealthModule,
    DataFeedHealthModule,
    OverviewModule,
    OperationsModule,
    PlatformsModule,
    PartnersModule,
    RecipientsModule,
    DestinationsModule,
    WebhooksModule,
    AttestationsModule,
    ResolutionModule,
  ],
})
export class AppModule {}
