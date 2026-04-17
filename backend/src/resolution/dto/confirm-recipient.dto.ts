import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { EncryptedFieldDto } from '../../common/security/encrypted-field.dto';

export class ConfirmRecipientDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => EncryptedFieldDto)
  addressEncrypted?: EncryptedFieldDto;

  @IsString()
  @MaxLength(64)
  chain!: string;

  @IsString()
  @MaxLength(32)
  asset!: string;
}
