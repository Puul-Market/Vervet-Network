import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Prisma } from '@prisma/client';

export class UpdateRecipientDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  displayName?: string;

  @IsOptional()
  @IsObject()
  profile?: Prisma.InputJsonValue;
}
