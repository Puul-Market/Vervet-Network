import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateDestinationDto {
  @IsString()
  @MaxLength(64)
  recipientId!: string;

  @IsString()
  @MaxLength(64)
  chain!: string;

  @IsString()
  @MaxLength(32)
  asset!: string;

  @IsString()
  @MaxLength(200)
  address!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  memoValue?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
