import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { EnvironmentVariables } from '../config/environment';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(configService: ConfigService<EnvironmentVariables, true>) {
    const nodeEnvironment = configService.get('NODE_ENV', { infer: true });
    const connectionString = configService.get('DATABASE_URL', { infer: true });
    const poolMax = configService.get('DATABASE_POOL_MAX', { infer: true });
    const applicationName = configService.get('DATABASE_APPLICATION_NAME', {
      infer: true,
    });

    super({
      adapter: new PrismaPg({
        connectionString,
        allowExitOnIdle: nodeEnvironment === 'test',
        application_name: applicationName,
        max: poolMax,
      }),
      errorFormat: 'pretty',
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
