import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { EnvironmentVariables } from '../config/environment';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(configService: ConfigService<EnvironmentVariables, true>) {
    const nodeEnvironment = configService.get('NODE_ENV', { infer: true });

    super({
      adapter: new PrismaPg({
        connectionString: configService.get('DATABASE_URL', { infer: true }),
        allowExitOnIdle: nodeEnvironment === 'test',
      }),
      errorFormat: 'pretty',
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
