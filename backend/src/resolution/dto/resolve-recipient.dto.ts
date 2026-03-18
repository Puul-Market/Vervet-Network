import { IsString, MaxLength } from 'class-validator';

export class ResolveRecipientDto {
  @IsString()
  @MaxLength(128)
  recipientIdentifier!: string;

  @IsString()
  @MaxLength(64)
  chain!: string;

  @IsString()
  @MaxLength(32)
  asset!: string;
}
