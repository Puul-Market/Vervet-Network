import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePartnerProductionCorridorDto {
  @IsString()
  assetNetworkId!: string;

  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
