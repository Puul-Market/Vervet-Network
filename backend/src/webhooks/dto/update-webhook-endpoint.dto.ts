import { WebhookEventType, WebhookStatus } from '@prisma/client';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class UpdateWebhookEndpointDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsUrl({
    require_tld: false,
  })
  @MaxLength(2048)
  url?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(WebhookEventType, { each: true })
  eventTypes?: WebhookEventType[];

  @IsOptional()
  @IsEnum(WebhookStatus)
  status?: WebhookStatus;
}
