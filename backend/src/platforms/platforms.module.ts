import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NormalizationModule } from '../common/normalization/normalization.module';
import { PartnersModule } from '../partners/partners.module';
import { PlatformsController } from './platforms.controller';
import { PlatformsService } from './platforms.service';

@Module({
  imports: [AuthModule, PartnersModule, NormalizationModule],
  controllers: [PlatformsController],
  providers: [PlatformsService],
  exports: [PlatformsService],
})
export class PlatformsModule {}
