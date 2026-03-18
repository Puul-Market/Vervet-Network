import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  partnerUserRoleValues,
  type PartnerUserRoleValue,
} from '../partner-user.constants';

export class UpdatePartnerUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  fullName?: string;

  @IsOptional()
  @IsEnum(partnerUserRoleValues)
  role?: PartnerUserRoleValue;
}
