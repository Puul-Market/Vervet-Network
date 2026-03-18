import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  partnerUserRoleValues,
  type PartnerUserRoleValue,
} from '../partner-user.constants';

export class CreatePartnerUserInviteDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  fullName?: string;

  @IsEnum(partnerUserRoleValues)
  role!: PartnerUserRoleValue;
}
