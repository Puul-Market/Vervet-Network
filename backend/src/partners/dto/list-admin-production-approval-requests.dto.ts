import { ProductionApprovalRequestStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ListAdminProductionApprovalRequestsDto {
  @IsOptional()
  @IsEnum(ProductionApprovalRequestStatus)
  status?: ProductionApprovalRequestStatus;
}
