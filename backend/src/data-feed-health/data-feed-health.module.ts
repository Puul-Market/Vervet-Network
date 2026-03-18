import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PartnersModule } from '../partners/partners.module';
import { DataFeedHealthController } from './data-feed-health.controller';
import { DataFeedHealthService } from './data-feed-health.service';

@Module({
  imports: [AuthModule, PartnersModule],
  controllers: [DataFeedHealthController],
  providers: [DataFeedHealthService],
})
export class DataFeedHealthModule {}
