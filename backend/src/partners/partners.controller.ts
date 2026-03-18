import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminTokenAuthGuard } from '../auth/admin-token-auth.guard';
import { apiResponse } from '../common/http/api-response';
import { CreateApiCredentialDto } from './dto/create-api-credential.dto';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { CreatePartnerUserDto } from './dto/create-partner-user.dto';
import { DashboardMetadataService } from './dashboard-metadata.service';
import { ListAdminProductionApprovalRequestsDto } from './dto/list-admin-production-approval-requests.dto';
import { RegisterSigningKeyDto } from './dto/register-signing-key.dto';
import { ReviewProductionApprovalRequestDto } from './dto/review-production-approval-request.dto';
import { UpdatePartnerAdminStateDto } from './dto/update-partner-admin-state.dto';
import { UpdatePartnerProductionCorridorDto } from './dto/update-partner-production-corridor.dto';
import { PartnersService } from './partners.service';

@Controller('partners')
@UseGuards(AdminTokenAuthGuard)
export class PartnersController {
  constructor(
    private readonly partnersService: PartnersService,
    private readonly dashboardMetadataService: DashboardMetadataService,
  ) {}

  @Get('setup/status')
  getSetupStatus() {
    return apiResponse({
      authenticated: true,
    });
  }

  @Get('setup/metadata')
  getSetupMetadata() {
    return apiResponse(this.dashboardMetadataService.getAdminSetupMetadata());
  }

  @Post()
  async createPartner(@Body() createPartnerDto: CreatePartnerDto) {
    const partner = await this.partnersService.createPartner(createPartnerDto);

    return apiResponse(partner);
  }

  @Post('api-credentials')
  async createApiCredential(
    @Body() createApiCredentialDto: CreateApiCredentialDto,
  ) {
    const apiCredential = await this.partnersService.issueApiCredential(
      createApiCredentialDto,
    );

    return apiResponse(apiCredential);
  }

  @Post('signing-keys')
  async registerSigningKey(
    @Body() registerSigningKeyDto: RegisterSigningKeyDto,
  ) {
    const signingKey = await this.partnersService.registerSigningKey(
      registerSigningKeyDto,
    );

    return apiResponse(signingKey);
  }

  @Post('users')
  async createPartnerUser(@Body() createPartnerUserDto: CreatePartnerUserDto) {
    const partnerUser =
      await this.partnersService.createPartnerUser(createPartnerUserDto);

    return apiResponse(partnerUser);
  }

  @Get()
  async listPartners() {
    const partners = await this.partnersService.listAdminPartners();

    return apiResponse(partners);
  }

  @Get('corridors')
  async listAvailableProductionCorridors() {
    const corridors =
      await this.partnersService.listAdminAvailableProductionCorridors();

    return apiResponse(corridors);
  }

  @Get('production-approval-requests')
  async listProductionApprovalRequests(
    @Query()
    listProductionApprovalRequestsDto: ListAdminProductionApprovalRequestsDto,
  ) {
    const requests =
      await this.partnersService.listAdminProductionApprovalRequests(
        listProductionApprovalRequestsDto,
      );

    return apiResponse(requests);
  }

  @Post('production-approval-requests/:requestId/review')
  async reviewProductionApprovalRequest(
    @Body()
    reviewProductionApprovalRequestDto: ReviewProductionApprovalRequestDto,
    @Param('requestId') requestId: string,
  ) {
    const productionApprovalRequest =
      await this.partnersService.reviewProductionApprovalRequest(
        requestId,
        reviewProductionApprovalRequestDto,
      );

    return apiResponse(productionApprovalRequest);
  }

  @Patch(':partnerId/admin-state')
  async updatePartnerAdminState(
    @Param('partnerId') partnerId: string,
    @Body() updatePartnerAdminStateDto: UpdatePartnerAdminStateDto,
  ) {
    const partner = await this.partnersService.updatePartnerAdminState(
      partnerId,
      updatePartnerAdminStateDto,
    );

    return apiResponse(partner);
  }

  @Get(':partnerId/production-corridors')
  async listPartnerProductionCorridors(@Param('partnerId') partnerId: string) {
    const corridors =
      await this.partnersService.listAdminPartnerProductionCorridors(partnerId);

    return apiResponse(corridors);
  }

  @Post(':partnerId/production-corridors')
  async updatePartnerProductionCorridor(
    @Param('partnerId') partnerId: string,
    @Body()
    updatePartnerProductionCorridorDto: UpdatePartnerProductionCorridorDto,
  ) {
    const corridor = await this.partnersService.updatePartnerProductionCorridor(
      partnerId,
      updatePartnerProductionCorridorDto,
    );

    return apiResponse(corridor);
  }
}
