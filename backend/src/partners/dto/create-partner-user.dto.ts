import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  partnerUserRoleValues,
  type PartnerUserRoleValue,
} from '../partner-user.constants';

export class CreatePartnerUserDto {
  @IsString()
  @MaxLength(80)
  partnerSlug!: string;

  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MaxLength(160)
  fullName!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(200)
  password!: string;

  @IsOptional()
  @IsEnum(partnerUserRoleValues)
  role?: PartnerUserRoleValue;
}
