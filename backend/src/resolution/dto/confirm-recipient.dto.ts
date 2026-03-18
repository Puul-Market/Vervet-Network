import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ConfirmRecipientDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  platform?: string;

  @IsString()
  @MaxLength(200)
  address!: string;

  @IsString()
  @MaxLength(64)
  chain!: string;

  @IsString()
  @MaxLength(32)
  asset!: string;
}
