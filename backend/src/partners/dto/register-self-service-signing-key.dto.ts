import { SigningKeyAlgorithm } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class RegisterSelfServiceSigningKeyDto {
  @IsString()
  @MaxLength(128)
  keyId!: string;

  @IsEnum(SigningKeyAlgorithm)
  algorithm!: SigningKeyAlgorithm;

  @IsString()
  publicKeyPem!: string;

  @IsDateString()
  validFrom!: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;
}
