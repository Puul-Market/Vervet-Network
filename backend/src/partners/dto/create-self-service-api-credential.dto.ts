import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { credentialScopes } from '../api-credential.util';

export class CreateSelfServiceApiCredentialDto {
  @IsString()
  @MaxLength(120)
  label!: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsIn(credentialScopes, { each: true })
  scopes?: string[];
}
