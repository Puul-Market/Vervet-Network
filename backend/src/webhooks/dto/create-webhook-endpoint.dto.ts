import { WebhookEventType } from '@prisma/client';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateWebhookEndpointDto {
  @IsString()
  @MaxLength(120)
  label!: string;

  @IsUrl({
    require_tld: false,
  })
  @MaxLength(2048)
  url!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(WebhookEventType, { each: true })
  eventTypes!: WebhookEventType[];
}
