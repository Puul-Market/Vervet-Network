import {
  AttestationType,
  IdentifierKind,
  SigningKeyAlgorithm,
  TokenStandard,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { EncryptedFieldDto } from '../../common/security/encrypted-field.dto';

export class CreateAttestationDto {
  @IsString()
  @MaxLength(64)
  partnerSlug!: string;

  @IsString()
  @MaxLength(128)
  keyId!: string;

  @IsEnum(SigningKeyAlgorithm)
  algorithm!: SigningKeyAlgorithm;

  @IsEnum(AttestationType)
  attestationType!: AttestationType;

  @IsInt()
  @Min(1)
  sequenceNumber!: number;

  @IsString()
  @MaxLength(128)
  recipientExternalId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  recipientDisplayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  recipientIdentifier?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => EncryptedFieldDto)
  recipientIdentifierEncrypted?: EncryptedFieldDto;

  @IsEnum(IdentifierKind)
  identifierKind!: IdentifierKind;

  @IsString()
  @MaxLength(64)
  chain!: string;

  @IsString()
  @MaxLength(32)
  assetCode!: string;

  @IsString()
  @MaxLength(32)
  assetSymbol!: string;

  @IsEnum(TokenStandard)
  tokenStandard!: TokenStandard;

  @IsOptional()
  @IsString()
  contractAddress?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  decimals?: number;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => EncryptedFieldDto)
  addressEncrypted?: EncryptedFieldDto;

  @IsOptional()
  @IsString()
  memo?: string;

  @IsDateString()
  issuedAt!: string;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsString()
  signature!: string;
}
