import { QueryType, ResolutionOutcome, RiskLevel } from '@prisma/client';
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

export class ListResolutionLogsDto {
  @IsOptional()
  @IsEnum(QueryType)
  queryType?: QueryType;

  @IsOptional()
  @IsEnum(ResolutionOutcome)
  outcome?: ResolutionOutcome;

  @IsOptional()
  @IsEnum(RiskLevel)
  riskLevel?: RiskLevel;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  chain?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  asset?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  recipientIdentifier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  platform?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
