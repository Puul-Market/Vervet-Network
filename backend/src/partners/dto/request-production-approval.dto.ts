import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class RequestProductionApprovalDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  requestNote?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(25)
  @IsString({ each: true })
  assetNetworkIds?: string[];
}
