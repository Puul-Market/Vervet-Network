import {
  PartnerFeedHealthStatus,
  PartnerOnboardingStage,
  PartnerPricingPlan,
  PartnerStatus,
} from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export class UpdatePartnerAdminStateDto {
  @IsOptional()
  @IsEnum(PartnerStatus)
  status?: PartnerStatus;

  @IsOptional()
  @IsEnum(PartnerOnboardingStage)
  onboardingStage?: PartnerOnboardingStage;

  @IsOptional()
  @IsEnum(PartnerFeedHealthStatus)
  feedHealthStatus?: PartnerFeedHealthStatus;

  @IsOptional()
  @IsEnum(PartnerPricingPlan)
  pricingPlan?: PartnerPricingPlan;

  @IsOptional()
  @IsBoolean()
  apiConsumerEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  dataPartnerEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  fullAttestationPartnerEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  webhooksEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  batchVerificationEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  auditExportsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  sandboxEnabled?: boolean;
}
