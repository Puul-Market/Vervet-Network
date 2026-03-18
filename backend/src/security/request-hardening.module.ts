import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RequestHardeningService } from './request-hardening.service';

@Module({
  imports: [PrismaModule],
  providers: [RequestHardeningService],
  exports: [RequestHardeningService],
})
export class RequestHardeningModule {}
