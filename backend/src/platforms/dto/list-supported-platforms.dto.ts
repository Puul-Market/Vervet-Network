import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ListSupportedPlatformsDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  chain?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  asset?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsIn(['BY_ADDRESS', 'BY_RECIPIENT'])
  lookupMode?: 'BY_ADDRESS' | 'BY_RECIPIENT';
}
