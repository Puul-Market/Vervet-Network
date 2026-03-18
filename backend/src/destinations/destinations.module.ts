import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NormalizationModule } from '../common/normalization/normalization.module';
import { PartnersModule } from '../partners/partners.module';
import { DestinationsController } from './destinations.controller';
import { DestinationsService } from './destinations.service';

@Module({
  imports: [AuthModule, NormalizationModule, PartnersModule],
  controllers: [DestinationsController],
  providers: [DestinationsService],
  exports: [DestinationsService],
})
export class DestinationsModule {}
