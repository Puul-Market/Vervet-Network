import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/environment';
import { ResolutionService } from '../resolution/resolution.service';
import { RequestHardeningService } from '../security/request-hardening.service';
import { WebhooksService } from '../webhooks/webhooks.service';

@Injectable()
export class WebhookDeliveryProcessorService
  implements OnModuleDestroy, OnModuleInit
{
  private readonly logger = new Logger(WebhookDeliveryProcessorService.name);
  private intervalHandle?: NodeJS.Timeout;
  private isProcessing = false;

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
    private readonly webhooksService: WebhooksService,
    private readonly requestHardeningService: RequestHardeningService,
    private readonly resolutionService: ResolutionService,
  ) {}

  onModuleInit(): void {
    const workerEnabled = this.configService.get(
      'WEBHOOK_DELIVERY_PROCESSOR_ENABLED',
      {
        infer: true,
      },
    );

    if (!workerEnabled) {
      this.logger.log('Webhook delivery processor is disabled.');

      return;
    }

    const intervalMs = this.configService.get(
      'WEBHOOK_DELIVERY_PROCESSOR_INTERVAL_MS',
      {
        infer: true,
      },
    );

    this.intervalHandle = setInterval(() => {
      void this.runTick();
    }, intervalMs);

    void this.runTick();
  }

  onModuleDestroy(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
    }
  }

  private async runTick(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const expiredNonceCount =
        await this.requestHardeningService.cleanupExpiredRequestNonces();
      const deletedResolutionRequestCount =
        await this.resolutionService.cleanupHistoricalResolutionRequests(
          this.configService.get('RESOLUTION_REQUEST_RETENTION_MS', {
            infer: true,
          }),
        );
      const result = await this.webhooksService.processPendingDeliveries({
        limit: this.configService.get('WEBHOOK_DELIVERY_PROCESSOR_BATCH_SIZE', {
          infer: true,
        }),
      });

      if (
        result.processedCount > 0 ||
        expiredNonceCount > 0 ||
        deletedResolutionRequestCount > 0
      ) {
        this.logger.log(
          `Processed ${result.processedCount} webhook deliveries. ` +
            `Succeeded=${result.succeededCount} Rescheduled=${result.rescheduledCount} ` +
            `Abandoned=${result.abandonedCount} Skipped=${result.skippedCount} ` +
            `ExpiredNoncesDeleted=${expiredNonceCount} ` +
            `ResolutionRequestsDeleted=${deletedResolutionRequestCount}`,
        );
      }
    } catch (error: unknown) {
      this.logger.error(
        'Webhook delivery processor failed.',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.isProcessing = false;
    }
  }
}
