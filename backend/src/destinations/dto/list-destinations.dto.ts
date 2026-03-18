import { DestinationStatus } from '@prisma/client';
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

export class ListDestinationsDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  recipientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  chain?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  asset?: string;

  @IsOptional()
  @IsEnum(DestinationStatus)
  status?: DestinationStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
