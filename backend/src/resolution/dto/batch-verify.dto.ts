import { ResolutionBatchInputFormat } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export const resolutionBatchLookupModes = [
  'BY_RECIPIENT',
  'BY_ADDRESS',
  'MIXED',
] as const;

export const resolutionBatchRowLookupModes = [
  'BY_RECIPIENT',
  'BY_ADDRESS',
] as const;

export type ResolutionBatchLookupMode =
  (typeof resolutionBatchLookupModes)[number];
export type ResolutionBatchRowLookupMode =
  (typeof resolutionBatchRowLookupModes)[number];

export class BatchVerifyRowDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  clientReference?: string;

  @IsOptional()
  @IsIn(resolutionBatchRowLookupModes)
  lookupMode?: ResolutionBatchRowLookupMode;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  recipientIdentifier!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  platform?: string;

  @IsString()
  @MaxLength(200)
  address!: string;
}

export class BatchVerifyDto {
  @IsEnum(ResolutionBatchInputFormat)
  inputFormat!: ResolutionBatchInputFormat;

  @IsString()
  @MaxLength(64)
  chain!: string;

  @IsString()
  @MaxLength(32)
  asset!: string;

  @IsOptional()
  @IsIn(resolutionBatchLookupModes)
  lookupMode?: ResolutionBatchLookupMode;

  @IsOptional()
  @IsBoolean()
  stopOnFirstHighRisk?: boolean;

  @IsOptional()
  @IsBoolean()
  requireExactAttestedMatch?: boolean;

  @IsArray()
  @ArrayMaxSize(250)
  @ValidateNested({ each: true })
  @Type(() => BatchVerifyRowDto)
  rows!: BatchVerifyRowDto[];
}
