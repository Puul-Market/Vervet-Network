import {
  IdentifierKind,
  IdentifierVisibility,
  type Prisma,
} from '@prisma/client';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateRecipientDto {
  @IsString()
  @MaxLength(120)
  externalRecipientId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  displayName?: string;

  @IsString()
  @MaxLength(160)
  primaryIdentifier!: string;

  @IsOptional()
  @IsEnum(IdentifierKind)
  identifierKind?: IdentifierKind;

  @IsOptional()
  @IsEnum(IdentifierVisibility)
  visibility?: IdentifierVisibility;

  @IsOptional()
  @IsObject()
  profile?: Prisma.InputJsonValue;
}
