import { PartnerPricingPlan, PartnerType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePartnerDto {
  @IsString()
  @MaxLength(64)
  slug!: string;

  @IsString()
  @MaxLength(120)
  displayName!: string;

  @IsEnum(PartnerType)
  partnerType!: PartnerType;

  @IsOptional()
  @IsEnum(PartnerPricingPlan)
  pricingPlan?: PartnerPricingPlan;
}
