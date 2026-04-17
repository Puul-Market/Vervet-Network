import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { EncryptedFieldDto } from '../../common/security/encrypted-field.dto';

export class VerifyDestinationDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  recipientIdentifier?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => EncryptedFieldDto)
  recipientIdentifierEncrypted?: EncryptedFieldDto;

  @IsString()
  @MaxLength(64)
  chain!: string;

  @IsString()
  @MaxLength(32)
  asset!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => EncryptedFieldDto)
  addressEncrypted?: EncryptedFieldDto;
}
