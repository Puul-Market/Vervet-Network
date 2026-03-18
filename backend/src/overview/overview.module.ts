import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PartnersModule } from '../partners/partners.module';
import { OverviewController } from './overview.controller';
import { OverviewService } from './overview.service';

@Module({
  imports: [AuthModule, PartnersModule],
  controllers: [OverviewController],
  providers: [OverviewService],
})
export class OverviewModule {}
