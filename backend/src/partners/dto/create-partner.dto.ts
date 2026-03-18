import { PartnerType } from '@prisma/client';
import { IsEnum, IsString, MaxLength } from 'class-validator';

export class CreatePartnerDto {
  @IsString()
  @MaxLength(64)
  slug!: string;

  @IsString()
  @MaxLength(120)
  displayName!: string;

  @IsEnum(PartnerType)
  partnerType!: PartnerType;
}
