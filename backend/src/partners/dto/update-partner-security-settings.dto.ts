import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePartnerSecuritySettingsDto {
  @IsOptional()
  @Type(() => Number)
  @Min(5)
  sessionIdleTimeoutMinutes?: number;

  @IsOptional()
  @IsBoolean()
  enforceMfa?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  ipAllowlist?: string[];

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  credentialRotationDays?: number;
}
