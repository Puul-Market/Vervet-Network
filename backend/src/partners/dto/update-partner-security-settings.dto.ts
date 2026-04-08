import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Max,
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

  @IsOptional()
  @IsIn(['MASKED_LABEL', 'VERIFICATION_ONLY'])
  defaultDisclosureMode?: 'MASKED_LABEL' | 'VERIFICATION_ONLY';

  @IsOptional()
  @IsBoolean()
  allowFullLabelDisclosure?: boolean;

  @IsOptional()
  @IsIn(['NO_RETAIN', 'SHORT_RETENTION', 'STANDARD_RETENTION'])
  rawVerificationRetentionMode?:
    | 'NO_RETAIN'
    | 'SHORT_RETENTION'
    | 'STANDARD_RETENTION';

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(720)
  rawVerificationRetentionHours?: number;

  @IsOptional()
  @IsBoolean()
  encryptAuditExports?: boolean;
}
