import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class EncryptedFieldDto {
  @IsIn(['AES-256-GCM'])
  alg!: 'AES-256-GCM';

  @IsString()
  @MaxLength(128)
  keyId!: string;

  @IsString()
  @MaxLength(512)
  iv!: string;

  @IsString()
  ciphertext!: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  authTag?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  aad?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  blindIndex?: string;
}
