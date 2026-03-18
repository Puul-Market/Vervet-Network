import { DeliveryStatus, WebhookEventType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListWebhookDeliveriesDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  endpointId?: string;

  @IsOptional()
  @IsEnum(DeliveryStatus)
  status?: DeliveryStatus;

  @IsOptional()
  @IsEnum(WebhookEventType)
  eventType?: WebhookEventType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
