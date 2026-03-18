import { IsString, MaxLength, MinLength } from 'class-validator';

export class AcceptPartnerUserInviteDto {
  @IsString()
  @MaxLength(160)
  fullName!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(200)
  password!: string;
}
