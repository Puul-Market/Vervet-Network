import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PartnersModule } from '../partners/partners.module';
import { AuditController } from './audit.controller';
import { AuditExportsController } from './audit-exports.controller';
import { AuditModule } from './audit.module';

@Module({
  imports: [AuditModule, AuthModule, PartnersModule],
  controllers: [AuditController, AuditExportsController],
})
export class AuditApiModule {}
