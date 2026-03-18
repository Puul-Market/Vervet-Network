import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditActorType,
  PartnerFeedHealthStatus,
  Partner,
  PartnerOnboardingStage,
  PartnerProductionCorridorStatus,
  ProductionApprovalRequestStatus,
  PartnerStatus,
  PartnerUserInviteStatus,
  PartnerUserRole,
  Prisma,
  RecipientStatus,
  SigningKeyStatus,
  VerificationStatus,
  WebhookStatus,
} from '@prisma/client';
import { createHash, createPublicKey } from 'node:crypto';
import type { AuthenticatedPartner } from '../auth/authenticated-partner.interface';
import { AuditService } from '../audit/audit.service';
import { NormalizationService } from '../common/normalization/normalization.service';
import { hashSecret, verifySecret } from '../common/security/secret-hash.util';
import type { EnvironmentVariables } from '../config/environment';
import { PrismaService } from '../prisma/prisma.service';
import {
  defaultCredentialScopes,
  extractApiCredentialPrefix,
  generateApiCredential,
  normalizeCredentialScopes,
  verifyApiCredentialSecret,
} from './api-credential.util';
import {
  extractDashboardSessionPrefix,
  generateDashboardSessionToken,
  verifyDashboardSessionToken,
} from './dashboard-session.util';
import { CreateApiCredentialDto } from './dto/create-api-credential.dto';
import { AcceptPartnerUserInviteDto } from './dto/accept-partner-user-invite.dto';
import { CreatePartnerUserDto } from './dto/create-partner-user.dto';
import { CreatePartnerUserInviteDto } from './dto/create-partner-user-invite.dto';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { CreateSelfServiceApiCredentialDto } from './dto/create-self-service-api-credential.dto';
import { DashboardLoginDto } from './dto/dashboard-login.dto';
import { ListAdminProductionApprovalRequestsDto } from './dto/list-admin-production-approval-requests.dto';
import { RequestProductionApprovalDto } from './dto/request-production-approval.dto';
import { RegisterSelfServiceSigningKeyDto } from './dto/register-self-service-signing-key.dto';
import { RegisterSigningKeyDto } from './dto/register-signing-key.dto';
import { ReviewProductionApprovalRequestDto } from './dto/review-production-approval-request.dto';
import { UpdatePartnerSecuritySettingsDto } from './dto/update-partner-security-settings.dto';
import { UpdatePartnerAdminStateDto } from './dto/update-partner-admin-state.dto';
import { UpdatePartnerProductionCorridorDto } from './dto/update-partner-production-corridor.dto';
import { UpdatePartnerUserDto } from './dto/update-partner-user.dto';
import {
  partnerUserRoleValues,
  partnerUserStatusValues,
  type PartnerUserRoleValue,
} from './partner-user.constants';
import {
  onboardingActionCatalog,
  productionApprovalBlockedReasonDescriptions,
} from './dashboard-metadata.constants';
import {
  extractPartnerUserInvitePrefix,
  generatePartnerUserInviteToken,
  verifyPartnerUserInviteToken,
} from './partner-user-invite.util';

const partnerApiCredentialSelect = {
  id: true,
  label: true,
  keyPrefix: true,
  scopes: true,
  status: true,
  lastUsedAt: true,
  createdAt: true,
  revokedAt: true,
} satisfies Prisma.PartnerApiCredentialSelect;

const partnerSigningKeySelect = {
  id: true,
  keyId: true,
  algorithm: true,
  fingerprint: true,
  status: true,
  validFrom: true,
  validTo: true,
  rotatesAt: true,
  revokedAt: true,
  createdAt: true,
} satisfies Prisma.PartnerSigningKeySelect;

const partnerUserSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  scopes: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

const partnerUserInviteSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  scopes: true,
  status: true,
  expiresAt: true,
  acceptedAt: true,
  revokedAt: true,
  createdAt: true,
} as const;

const partnerSecuritySettingsSelect = {
  id: true,
  sessionIdleTimeoutMinutes: true,
  enforceMfa: true,
  ipAllowlist: true,
  credentialRotationDays: true,
  createdAt: true,
  updatedAt: true,
} as const;

const corridorAssetNetworkSelect = {
  id: true,
  standard: true,
  contractAddressRaw: true,
  decimals: true,
  memoPolicy: true,
  memoLabel: true,
  chain: {
    select: {
      id: true,
      slug: true,
      displayName: true,
    },
  },
  asset: {
    select: {
      id: true,
      code: true,
      symbol: true,
      displayName: true,
    },
  },
} satisfies Prisma.AssetNetworkSelect;

const requestedProductionApprovalCorridorSelect = {
  id: true,
  assetNetwork: {
    select: corridorAssetNetworkSelect,
  },
} satisfies Prisma.PartnerProductionApprovalRequestCorridorSelect;

const approvedProductionApprovalCorridorSelect = {
  id: true,
  assetNetwork: {
    select: corridorAssetNetworkSelect,
  },
} satisfies Prisma.PartnerProductionApprovalApprovedCorridorSelect;

const partnerProductionApprovalRequestSelect = {
  id: true,
  status: true,
  requestNote: true,
  reviewNote: true,
  reviewedByIdentifier: true,
  requestedAt: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  requestedByUser: {
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
    },
  },
  requestedCorridors: {
    select: requestedProductionApprovalCorridorSelect,
  },
  approvedCorridors: {
    select: approvedProductionApprovalCorridorSelect,
  },
} satisfies Prisma.PartnerProductionApprovalRequestSelect;

const partnerProductionApprovalRequestMutationSelect = {
  id: true,
} satisfies Prisma.PartnerProductionApprovalRequestSelect;

type PartnerProductionApprovalRequestRecord =
  Prisma.PartnerProductionApprovalRequestGetPayload<{
    select: typeof partnerProductionApprovalRequestSelect;
  }>;

const reviewableProductionApprovalRequestSelect = {
  ...partnerProductionApprovalRequestSelect,
  partner: {
    select: {
      id: true,
      slug: true,
    },
  },
} satisfies Prisma.PartnerProductionApprovalRequestSelect;

type ReviewableProductionApprovalRequestRecord =
  Prisma.PartnerProductionApprovalRequestGetPayload<{
    select: typeof reviewableProductionApprovalRequestSelect;
  }>;

const partnerProductionCorridorSelect = {
  id: true,
  status: true,
  note: true,
  grantedByIdentifier: true,
  grantedAt: true,
  revokedAt: true,
  createdAt: true,
  updatedAt: true,
  assetNetwork: {
    select: corridorAssetNetworkSelect,
  },
} as const;

type PartnerProductionCorridorRecord =
  Prisma.PartnerProductionCorridorGetPayload<{
    select: typeof partnerProductionCorridorSelect;
  }>;

const adminPartnerSelect = {
  id: true,
  slug: true,
  displayName: true,
  partnerType: true,
  status: true,
  apiConsumerEnabled: true,
  dataPartnerEnabled: true,
  fullAttestationPartnerEnabled: true,
  webhooksEnabled: true,
  batchVerificationEnabled: true,
  auditExportsEnabled: true,
  sandboxEnabled: true,
  productionEnabled: true,
  onboardingStage: true,
  feedHealthStatus: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PartnerSelect;

type AdminPartnerRecord = Prisma.PartnerGetPayload<{
  select: typeof adminPartnerSelect;
}>;

const adminProductionApprovalRequestSelect = {
  ...partnerProductionApprovalRequestSelect,
  partner: {
    select: {
      id: true,
      slug: true,
      displayName: true,
      partnerType: true,
      status: true,
      productionEnabled: true,
      onboardingStage: true,
      feedHealthStatus: true,
    },
  },
} as const;

const ownerDashboardScopes = normalizeCredentialScopes([
  'partners:read',
  'partners:write',
  'attestations:read',
  'attestations:write',
  'recipients:read',
  'recipients:write',
  'destinations:read',
  'destinations:write',
  'resolution:read',
  'resolution:batch',
  'webhooks:read',
  'webhooks:write',
  'webhooks:replay',
  'team:read',
  'team:write',
  'security:read',
  'security:write',
  'audit:read',
  'audit:export',
]);

const adminDashboardScopes = normalizeCredentialScopes([
  'partners:read',
  'partners:write',
  'attestations:read',
  'attestations:write',
  'recipients:read',
  'recipients:write',
  'destinations:read',
  'destinations:write',
  'resolution:read',
  'resolution:batch',
  'webhooks:read',
  'webhooks:write',
  'webhooks:replay',
  'team:read',
  'team:write',
  'security:read',
  'audit:read',
  'audit:export',
]);

const developerDashboardScopes = normalizeCredentialScopes([
  'partners:read',
  'partners:write',
  'attestations:read',
  'recipients:read',
  'destinations:read',
  'resolution:read',
  'resolution:batch',
  'webhooks:read',
  'webhooks:write',
  'webhooks:replay',
  'audit:read',
]);

const analystDashboardScopes = normalizeCredentialScopes([
  'partners:read',
  'attestations:read',
  'recipients:read',
  'destinations:read',
  'resolution:read',
  'webhooks:read',
  'audit:read',
]);

const readOnlyDashboardScopes = normalizeCredentialScopes([
  'partners:read',
  'attestations:read',
  'recipients:read',
  'destinations:read',
  'resolution:read',
  'webhooks:read',
  'audit:read',
]);

interface AuditActorContext {
  actorIdentifier: string;
  actorPartnerId?: string;
  actorType: AuditActorType;
}

export interface PartnerOperationalCounts {
  activeCredentialCount: number;
  activeSigningKeyCount: number;
  activeWebhookCount: number;
  activeRecipientCount: number;
  verifiedAttestationCount: number;
  resolutionRequestCount: number;
}

type IssueCredentialInput = Pick<CreateApiCredentialDto, 'label' | 'scopes'> &
  Partial<Pick<CreateApiCredentialDto, 'partnerSlug'>>;

type RegisterKeyInput = Pick<
  RegisterSigningKeyDto,
  'algorithm' | 'keyId' | 'publicKeyPem' | 'validFrom' | 'validTo'
> &
  Partial<Pick<RegisterSigningKeyDto, 'partnerSlug'>>;

@Injectable()
export class PartnersService {
  private readonly lastCredentialUseWriteAt = new Map<string, number>();
  private readonly lastDashboardSessionUseWriteAt = new Map<string, number>();

  constructor(
    private readonly prismaService: PrismaService,
    private readonly normalizationService: NormalizationService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  async createPartner(createPartnerDto: CreatePartnerDto) {
    const slug = this.normalizationService.normalizePartnerSlug(
      createPartnerDto.slug,
    );
    const displayName = createPartnerDto.displayName.trim();
    const existingPartner = await this.prismaService.partner.findUnique({
      where: { slug },
    });

    if (existingPartner) {
      throw new ConflictException(`Partner '${slug}' already exists.`);
    }

    return this.prismaService.$transaction(async (transaction) => {
      const partner = await transaction.partner.create({
        data: {
          slug,
          displayName,
          partnerType: createPartnerDto.partnerType,
          status: PartnerStatus.ACTIVE,
          apiConsumerEnabled: true,
          dataPartnerEnabled: false,
          fullAttestationPartnerEnabled: false,
          webhooksEnabled: true,
          batchVerificationEnabled: true,
          auditExportsEnabled: true,
          sandboxEnabled: true,
          productionEnabled: false,
          onboardingStage: PartnerOnboardingStage.ACCOUNT_CREATED,
          feedHealthStatus: PartnerFeedHealthStatus.UNKNOWN,
        },
        select: {
          id: true,
          slug: true,
          displayName: true,
          partnerType: true,
          status: true,
          createdAt: true,
        },
      });

      await transaction.partnerSecuritySettings.create({
        data: {
          partnerId: partner.id,
          sessionIdleTimeoutMinutes: this.configService.get(
            'PARTNER_SECURITY_DEFAULT_SESSION_IDLE_TIMEOUT_MINUTES',
            {
              infer: true,
            },
          ),
          credentialRotationDays: this.configService.get(
            'PARTNER_SECURITY_DEFAULT_CREDENTIAL_ROTATION_DAYS',
            {
              infer: true,
            },
          ),
        },
      });

      await this.auditService.recordEvent(
        {
          actorType: AuditActorType.SYSTEM,
          actorIdentifier: 'admin-token',
          subjectPartnerId: partner.id,
          action: 'partner.created',
          entityType: 'Partner',
          entityId: partner.id,
          summary: `Created partner '${partner.slug}'.`,
          metadata: {
            partnerSlug: partner.slug,
            partnerType: partner.partnerType,
          },
        },
        transaction,
      );

      return partner;
    });
  }

  async createPartnerUser(createPartnerUserDto: CreatePartnerUserDto) {
    const partner = await this.getPartnerBySlugOrThrow(
      createPartnerUserDto.partnerSlug,
    );

    if (partner.status !== PartnerStatus.ACTIVE) {
      throw new ConflictException(
        `Partner '${partner.slug}' is not active for user creation.`,
      );
    }

    const email = this.normalizeUserEmail(createPartnerUserDto.email);
    const fullName = this.normalizeUserFullName(createPartnerUserDto.fullName);
    const role = createPartnerUserDto.role ?? partnerUserRoleValues.OWNER;
    const password = createPartnerUserDto.password;

    this.assertValidDashboardPassword(password);

    const existingUser = await this.prismaService.partnerUser.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      throw new ConflictException(`Partner user '${email}' already exists.`);
    }

    const passwordHash = hashSecret(password);
    const scopes = this.getPartnerUserScopes(role);

    return this.prismaService.$transaction(async (transaction) => {
      const partnerUser = await transaction.partnerUser.create({
        data: {
          partnerId: partner.id,
          email,
          fullName,
          role,
          scopes,
          passwordHash,
          status: partnerUserStatusValues.ACTIVE,
        },
        select: partnerUserSelect,
      });

      await this.auditService.recordEvent(
        {
          actorType: AuditActorType.SYSTEM,
          actorIdentifier: 'admin-token',
          subjectPartnerId: partner.id,
          action: 'partner.user.created',
          entityType: 'PartnerUser',
          entityId: partnerUser.id,
          summary: `Created partner user '${partnerUser.email}' for partner '${partner.slug}'.`,
          metadata: {
            email: partnerUser.email,
            fullName: partnerUser.fullName,
            role: partnerUser.role,
            scopes: partnerUser.scopes,
          },
        },
        transaction,
      );

      return partnerUser;
    });
  }

  async listPartnerUsers(authenticatedPartner: AuthenticatedPartner) {
    const [users, invites] = await Promise.all([
      this.prismaService.partnerUser.findMany({
        where: {
          partnerId: authenticatedPartner.partnerId,
        },
        orderBy: [
          {
            role: 'asc',
          },
          {
            createdAt: 'desc',
          },
        ],
        select: partnerUserSelect,
      }),
      this.prismaService.partnerUserInvite.findMany({
        where: {
          partnerId: authenticatedPartner.partnerId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: partnerUserInviteSelect,
      }),
    ]);

    return {
      users,
      invites,
    };
  }

  async invitePartnerUser(
    authenticatedPartner: AuthenticatedPartner,
    createPartnerUserInviteDto: CreatePartnerUserInviteDto,
  ) {
    await this.getPartnerByIdOrThrow(authenticatedPartner.partnerId);
    const email = this.normalizeUserEmail(createPartnerUserInviteDto.email);
    const fullName = createPartnerUserInviteDto.fullName?.trim() || null;
    const role = createPartnerUserInviteDto.role;
    const scopes = this.getPartnerUserScopes(role);
    const existingUser = await this.prismaService.partnerUser.findUnique({
      where: {
        email,
      },
    });

    if (
      existingUser &&
      existingUser.status === partnerUserStatusValues.ACTIVE
    ) {
      throw new ConflictException(
        `Partner user '${email}' already exists for dashboard access.`,
      );
    }

    const existingPendingInvite =
      await this.prismaService.partnerUserInvite.findFirst({
        where: {
          partnerId: authenticatedPartner.partnerId,
          email,
          status: PartnerUserInviteStatus.PENDING,
          revokedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

    if (existingPendingInvite) {
      throw new ConflictException(
        `An active invite for '${email}' already exists.`,
      );
    }

    const generatedInvite = generatePartnerUserInviteToken();
    const expiresAt = new Date(
      Date.now() +
        this.configService.get('PARTNER_USER_INVITE_TTL_MS', {
          infer: true,
        }),
    );

    return this.prismaService.$transaction(async (transaction) => {
      const invite = await transaction.partnerUserInvite.create({
        data: {
          partnerId: authenticatedPartner.partnerId,
          email,
          fullName,
          role,
          scopes,
          keyPrefix: generatedInvite.keyPrefix,
          secretHash: generatedInvite.secretHash,
          status: PartnerUserInviteStatus.PENDING,
          createdByUserId: authenticatedPartner.partnerUserId,
          expiresAt,
        },
        select: partnerUserInviteSelect,
      });

      await this.auditService.recordEvent(
        {
          ...this.buildPartnerAuditContext(authenticatedPartner),
          subjectPartnerId: authenticatedPartner.partnerId,
          action: 'partner.user.invited',
          entityType: 'PartnerUserInvite',
          entityId: invite.id,
          summary: `Invited dashboard user '${invite.email}'.`,
          metadata: {
            email: invite.email,
            role: invite.role,
            expiresAt: invite.expiresAt.toISOString(),
            scopes: invite.scopes,
          },
        },
        transaction,
      );

      return {
        ...invite,
        inviteToken: generatedInvite.secret,
      };
    });
  }

  async updatePartnerUser(
    authenticatedPartner: AuthenticatedPartner,
    userId: string,
    updatePartnerUserDto: UpdatePartnerUserDto,
  ) {
    const trimmedUserId = userId.trim();

    if (trimmedUserId.length === 0) {
      throw new BadRequestException('Partner user identifier is required.');
    }

    const existingUser = await this.prismaService.partnerUser.findFirst({
      where: {
        id: trimmedUserId,
        partnerId: authenticatedPartner.partnerId,
      },
      select: partnerUserSelect,
    });

    if (!existingUser) {
      throw new NotFoundException(
        `Partner user '${trimmedUserId}' was not found for this partner.`,
      );
    }

    if (
      authenticatedPartner.partnerUserId === existingUser.id &&
      updatePartnerUserDto.role &&
      updatePartnerUserDto.role !== existingUser.role
    ) {
      throw new ConflictException('You cannot change your own role.');
    }

    const updateData: Prisma.PartnerUserUpdateInput = {};

    if (updatePartnerUserDto.fullName !== undefined) {
      updateData.fullName = this.normalizeUserFullName(
        updatePartnerUserDto.fullName,
      );
    }

    if (
      updatePartnerUserDto.role !== undefined &&
      updatePartnerUserDto.role !== existingUser.role
    ) {
      updateData.role = updatePartnerUserDto.role;
      updateData.scopes = this.getPartnerUserScopes(updatePartnerUserDto.role);
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException(
        'At least one partner user field must be updated.',
      );
    }

    return this.prismaService.$transaction(async (transaction) => {
      const updatedUser = await transaction.partnerUser.update({
        where: {
          id: existingUser.id,
        },
        data: updateData,
        select: partnerUserSelect,
      });

      await this.auditService.recordEvent(
        {
          ...this.buildPartnerAuditContext(authenticatedPartner),
          subjectPartnerId: authenticatedPartner.partnerId,
          action: 'partner.user.updated',
          entityType: 'PartnerUser',
          entityId: updatedUser.id,
          summary: `Updated dashboard user '${updatedUser.email}'.`,
          metadata: {
            role: updatedUser.role,
            scopes: updatedUser.scopes,
            fullName: updatedUser.fullName,
          },
        },
        transaction,
      );

      return updatedUser;
    });
  }

  async deactivatePartnerUser(
    authenticatedPartner: AuthenticatedPartner,
    userId: string,
  ) {
    const trimmedUserId = userId.trim();

    if (trimmedUserId.length === 0) {
      throw new BadRequestException('Partner user identifier is required.');
    }

    if (trimmedUserId === authenticatedPartner.partnerUserId) {
      throw new ConflictException('You cannot deactivate your own account.');
    }

    const existingUser = await this.prismaService.partnerUser.findFirst({
      where: {
        id: trimmedUserId,
        partnerId: authenticatedPartner.partnerId,
      },
      select: partnerUserSelect,
    });

    if (!existingUser) {
      throw new NotFoundException(
        `Partner user '${trimmedUserId}' was not found for this partner.`,
      );
    }

    if (existingUser.status !== partnerUserStatusValues.ACTIVE) {
      throw new ConflictException(
        `Partner user '${existingUser.email}' is already inactive.`,
      );
    }

    if (existingUser.role === PartnerUserRole.OWNER) {
      const activeOwnerCount = await this.prismaService.partnerUser.count({
        where: {
          partnerId: authenticatedPartner.partnerId,
          role: PartnerUserRole.OWNER,
          status: partnerUserStatusValues.ACTIVE,
          disabledAt: null,
        },
      });

      if (activeOwnerCount <= 1) {
        throw new ConflictException(
          'Cannot deactivate the last active owner for this partner.',
        );
      }
    }

    return this.prismaService.$transaction(async (transaction) => {
      const deactivatedUser = await transaction.partnerUser.update({
        where: {
          id: existingUser.id,
        },
        data: {
          status: partnerUserStatusValues.DISABLED,
          disabledAt: new Date(),
        },
        select: partnerUserSelect,
      });

      await transaction.dashboardSession.updateMany({
        where: {
          partnerUserId: existingUser.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      await this.auditService.recordEvent(
        {
          ...this.buildPartnerAuditContext(authenticatedPartner),
          subjectPartnerId: authenticatedPartner.partnerId,
          action: 'partner.user.deactivated',
          entityType: 'PartnerUser',
          entityId: deactivatedUser.id,
          summary: `Deactivated dashboard user '${deactivatedUser.email}'.`,
          metadata: {
            role: deactivatedUser.role,
          },
        },
        transaction,
      );

      return deactivatedUser;
    });
  }

  async getPartnerSecuritySettings(partnerId: string) {
    return this.getOrCreatePartnerSecuritySettings(partnerId);
  }

  async updatePartnerSecuritySettings(
    authenticatedPartner: AuthenticatedPartner,
    updatePartnerSecuritySettingsDto: UpdatePartnerSecuritySettingsDto,
  ) {
    const currentSettings = await this.getOrCreatePartnerSecuritySettings(
      authenticatedPartner.partnerId,
    );
    const updateData: Prisma.PartnerSecuritySettingsUpdateInput = {};

    if (
      updatePartnerSecuritySettingsDto.sessionIdleTimeoutMinutes !== undefined
    ) {
      updateData.sessionIdleTimeoutMinutes =
        updatePartnerSecuritySettingsDto.sessionIdleTimeoutMinutes;
    }

    if (updatePartnerSecuritySettingsDto.enforceMfa !== undefined) {
      updateData.enforceMfa = updatePartnerSecuritySettingsDto.enforceMfa;
    }

    if (updatePartnerSecuritySettingsDto.ipAllowlist !== undefined) {
      updateData.ipAllowlist = this.normalizeIpAllowlist(
        updatePartnerSecuritySettingsDto.ipAllowlist,
      );
    }

    if (updatePartnerSecuritySettingsDto.credentialRotationDays !== undefined) {
      updateData.credentialRotationDays =
        updatePartnerSecuritySettingsDto.credentialRotationDays;
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException(
        'At least one security settings field must be updated.',
      );
    }

    return this.prismaService.$transaction(async (transaction) => {
      const updatedSettings = await transaction.partnerSecuritySettings.update({
        where: {
          id: currentSettings.id,
        },
        data: updateData,
        select: partnerSecuritySettingsSelect,
      });

      await this.auditService.recordEvent(
        {
          ...this.buildPartnerAuditContext(authenticatedPartner),
          subjectPartnerId: authenticatedPartner.partnerId,
          action: 'partner.security_settings.updated',
          entityType: 'PartnerSecuritySettings',
          entityId: updatedSettings.id,
          summary: `Updated partner security settings for '${authenticatedPartner.partnerSlug}'.`,
          metadata: {
            sessionIdleTimeoutMinutes:
              updatedSettings.sessionIdleTimeoutMinutes,
            enforceMfa: updatedSettings.enforceMfa,
            ipAllowlist: updatedSettings.ipAllowlist,
            credentialRotationDays: updatedSettings.credentialRotationDays,
          },
        },
        transaction,
      );

      return updatedSettings;
    });
  }

  async listProductionApprovalRequests(
    authenticatedPartner: AuthenticatedPartner,
  ) {
    return this.prismaService.partnerProductionApprovalRequest.findMany({
      where: {
        partnerId: authenticatedPartner.partnerId,
      },
      orderBy: {
        requestedAt: 'desc',
      },
      select: partnerProductionApprovalRequestSelect,
    });
  }

  async listPartnerProductionCorridors(
    authenticatedPartner: AuthenticatedPartner,
  ) {
    return this.listGrantedProductionCorridors(authenticatedPartner.partnerId);
  }

  async listPartnerAvailableProductionCorridors(
    authenticatedPartner: AuthenticatedPartner,
  ) {
    await this.getPartnerByIdOrThrow(authenticatedPartner.partnerId);

    return this.listAdminAvailableProductionCorridors();
  }

  async listAdminPartners() {
    const partners = await this.prismaService.partner.findMany({
      orderBy: [
        {
          createdAt: 'desc',
        },
      ],
      select: adminPartnerSelect,
    });

    return Promise.all(
      partners.map((partner) => this.buildAdminPartnerWorkspaceRecord(partner)),
    );
  }

  async listAdminProductionApprovalRequests(
    listProductionApprovalRequestsDto: ListAdminProductionApprovalRequestsDto,
  ) {
    return this.prismaService.partnerProductionApprovalRequest.findMany({
      where: {
        status: listProductionApprovalRequestsDto.status,
      },
      orderBy: {
        requestedAt: 'desc',
      },
      select: adminProductionApprovalRequestSelect,
    });
  }

  async listAdminAvailableProductionCorridors() {
    return this.prismaService.assetNetwork.findMany({
      where: {
        isActive: true,
        chain: {
          isActive: true,
        },
        asset: {
          isActive: true,
        },
      },
      orderBy: [
        {
          chain: {
            displayName: 'asc',
          },
        },
        {
          asset: {
            displayName: 'asc',
          },
        },
      ],
      select: corridorAssetNetworkSelect,
    });
  }

  async listAdminPartnerProductionCorridors(partnerId: string) {
    const trimmedPartnerId = partnerId.trim();

    if (trimmedPartnerId.length === 0) {
      throw new BadRequestException('Partner identifier is required.');
    }

    await this.getPartnerByIdOrThrow(trimmedPartnerId);

    return this.listGrantedProductionCorridors(trimmedPartnerId);
  }

  async requestProductionApproval(
    authenticatedPartner: AuthenticatedPartner,
    requestProductionApprovalDto: RequestProductionApprovalDto,
  ) {
    await this.assertProductionApprovalAccess(authenticatedPartner);

    const [partner, counts, latestRequest] = await Promise.all([
      this.getPartnerByIdOrThrow(authenticatedPartner.partnerId),
      this.getPartnerOperationalCounts(authenticatedPartner.partnerId),
      this.getLatestProductionApprovalRequest(authenticatedPartner.partnerId),
    ]);

    if (partner.productionEnabled) {
      throw new ConflictException(
        `Partner '${partner.slug}' is already production approved.`,
      );
    }

    if (latestRequest?.status === ProductionApprovalRequestStatus.PENDING) {
      throw new ConflictException(
        'A production approval request is already pending review.',
      );
    }

    const nextAction = this.resolveNextRecommendedAction(
      partner,
      counts,
      latestRequest,
    );

    if (
      nextAction !== null &&
      nextAction !== 'request_production_approval' &&
      nextAction !== 'await_production_review'
    ) {
      throw new BadRequestException(
        'Complete the required onboarding steps before requesting production approval.',
      );
    }

    if (
      (partner.dataPartnerEnabled || partner.fullAttestationPartnerEnabled) &&
      partner.feedHealthStatus !== PartnerFeedHealthStatus.HEALTHY
    ) {
      throw new BadRequestException(
        'Data partners must have healthy feed health before requesting production approval.',
      );
    }

    const requestNote = this.normalizeOptionalNote(
      requestProductionApprovalDto.requestNote,
    );
    const requestedAssetNetworkIds = this.normalizeRequestedAssetNetworkIds(
      requestProductionApprovalDto.assetNetworkIds,
    );
    const requestedCorridors = requestedAssetNetworkIds.length
      ? await this.getActiveAssetNetworksByIds(requestedAssetNetworkIds)
      : [];

    const createdRequestId = await this.prismaService.$transaction(
      async (transaction) => {
        const createdRequest =
          await transaction.partnerProductionApprovalRequest.create({
            data: {
              partnerId: authenticatedPartner.partnerId,
              requestedByUserId: authenticatedPartner.partnerUserId,
              requestNote,
            },
            select: partnerProductionApprovalRequestMutationSelect,
          });

        if (requestedAssetNetworkIds.length > 0) {
          await transaction.partnerProductionApprovalRequestCorridor.createMany(
            {
              data: requestedAssetNetworkIds.map((assetNetworkId) => ({
                requestId: createdRequest.id,
                assetNetworkId,
              })),
            },
          );
        }

        await this.auditService.recordEvent(
          {
            ...this.buildPartnerAuditContext(authenticatedPartner),
            subjectPartnerId: authenticatedPartner.partnerId,
            action: 'partner.production_approval.requested',
            entityType: 'PartnerProductionApprovalRequest',
            entityId: createdRequest.id,
            summary: `Requested production approval for '${authenticatedPartner.partnerSlug}'.`,
            metadata: {
              status: ProductionApprovalRequestStatus.PENDING,
              requestNote,
              requestedCorridors: requestedCorridors.map((corridor) => ({
                assetNetworkId: corridor.id,
                chain: corridor.chain.slug,
                asset: corridor.asset.symbol,
              })),
            },
          },
          transaction,
        );

        return createdRequest.id;
      },
    );

    return this.prismaService.partnerProductionApprovalRequest.findUniqueOrThrow(
      {
        where: {
          id: createdRequestId,
        },
        select: partnerProductionApprovalRequestSelect,
      },
    );
  }

  async cancelProductionApprovalRequest(
    authenticatedPartner: AuthenticatedPartner,
    requestId: string,
  ) {
    await this.assertProductionApprovalAccess(authenticatedPartner);

    const trimmedRequestId = requestId.trim();

    if (trimmedRequestId.length === 0) {
      throw new BadRequestException(
        'Production approval request identifier is required.',
      );
    }

    const existingRequest =
      await this.prismaService.partnerProductionApprovalRequest.findFirst({
        where: {
          id: trimmedRequestId,
          partnerId: authenticatedPartner.partnerId,
        },
        select: partnerProductionApprovalRequestSelect,
      });

    if (!existingRequest) {
      throw new NotFoundException(
        `Production approval request '${trimmedRequestId}' was not found for this partner.`,
      );
    }

    if (existingRequest.status !== ProductionApprovalRequestStatus.PENDING) {
      throw new ConflictException(
        'Only pending production approval requests can be cancelled.',
      );
    }

    const cancelledRequestId = await this.prismaService.$transaction(
      async (transaction) => {
        const cancelledRequest =
          await transaction.partnerProductionApprovalRequest.update({
            where: {
              id: existingRequest.id,
            },
            data: {
              status: ProductionApprovalRequestStatus.CANCELLED,
              reviewedAt: new Date(),
              reviewedByIdentifier: authenticatedPartner.actorIdentifier,
            },
            select: partnerProductionApprovalRequestMutationSelect,
          });

        await this.auditService.recordEvent(
          {
            ...this.buildPartnerAuditContext(authenticatedPartner),
            subjectPartnerId: authenticatedPartner.partnerId,
            action: 'partner.production_approval.cancelled',
            entityType: 'PartnerProductionApprovalRequest',
            entityId: cancelledRequest.id,
            summary: `Cancelled the production approval request for '${authenticatedPartner.partnerSlug}'.`,
            metadata: {
              status: ProductionApprovalRequestStatus.CANCELLED,
            },
          },
          transaction,
        );

        return cancelledRequest.id;
      },
    );

    return this.prismaService.partnerProductionApprovalRequest.findUniqueOrThrow(
      {
        where: {
          id: cancelledRequestId,
        },
        select: partnerProductionApprovalRequestSelect,
      },
    );
  }

  async reviewProductionApprovalRequest(
    requestId: string,
    reviewProductionApprovalRequestDto: ReviewProductionApprovalRequestDto,
  ) {
    const trimmedRequestId = requestId.trim();

    if (trimmedRequestId.length === 0) {
      throw new BadRequestException(
        'Production approval request identifier is required.',
      );
    }

    const existingRequest: ReviewableProductionApprovalRequestRecord | null =
      await this.prismaService.partnerProductionApprovalRequest.findUnique({
        where: {
          id: trimmedRequestId,
        },
        select: reviewableProductionApprovalRequestSelect,
      });

    if (!existingRequest) {
      throw new NotFoundException(
        `Production approval request '${trimmedRequestId}' was not found.`,
      );
    }

    if (existingRequest.status !== ProductionApprovalRequestStatus.PENDING) {
      throw new ConflictException(
        'Only pending production approval requests can be reviewed.',
      );
    }

    const reviewedAt = new Date();
    const nextStatus =
      reviewProductionApprovalRequestDto.decision === 'APPROVED'
        ? ProductionApprovalRequestStatus.APPROVED
        : ProductionApprovalRequestStatus.REJECTED;
    const reviewNote = this.normalizeOptionalNote(
      reviewProductionApprovalRequestDto.reviewNote,
    );
    const overrideApprovedAssetNetworkIds =
      this.normalizeRequestedAssetNetworkIds(
        reviewProductionApprovalRequestDto.approvedAssetNetworkIds,
      );
    const requestedCorridorAssets = existingRequest.requestedCorridors.map(
      (requestedCorridor) => requestedCorridor.assetNetwork,
    );
    const approvedCorridorAssets = overrideApprovedAssetNetworkIds.length
      ? await this.getActiveAssetNetworksByIds(overrideApprovedAssetNetworkIds)
      : requestedCorridorAssets;

    if (
      nextStatus === ProductionApprovalRequestStatus.APPROVED &&
      approvedCorridorAssets.length === 0
    ) {
      throw new BadRequestException(
        'At least one production corridor must be approved before production access can be granted.',
      );
    }

    const reviewedRequestId = await this.prismaService.$transaction(
      async (transaction) => {
        const reviewedRequest =
          await transaction.partnerProductionApprovalRequest.update({
            where: {
              id: existingRequest.id,
            },
            data: {
              status: nextStatus,
              reviewNote,
              reviewedAt,
              reviewedByIdentifier: 'admin-token',
            },
            select: partnerProductionApprovalRequestMutationSelect,
          });

        if (nextStatus === ProductionApprovalRequestStatus.APPROVED) {
          await transaction.partnerProductionApprovalApprovedCorridor.deleteMany(
            {
              where: {
                requestId: existingRequest.id,
              },
            },
          );

          await transaction.partnerProductionApprovalApprovedCorridor.createMany(
            {
              data: approvedCorridorAssets.map((approvedCorridorAsset) => ({
                requestId: existingRequest.id,
                assetNetworkId: approvedCorridorAsset.id,
              })),
            },
          );
        }

        if (nextStatus === ProductionApprovalRequestStatus.APPROVED) {
          await transaction.partner.update({
            where: {
              id: existingRequest.partner.id,
            },
            data: {
              productionEnabled: true,
              onboardingStage: PartnerOnboardingStage.PRODUCTION_APPROVED,
            },
          });

          for (const approvedCorridorAsset of approvedCorridorAssets) {
            await transaction.partnerProductionCorridor.upsert({
              where: {
                partnerId_assetNetworkId: {
                  partnerId: existingRequest.partner.id,
                  assetNetworkId: approvedCorridorAsset.id,
                },
              },
              update: {
                status: PartnerProductionCorridorStatus.GRANTED,
                note:
                  reviewNote ??
                  existingRequest.requestNote ??
                  'Granted during production approval review.',
                grantedByIdentifier: 'admin-token',
                grantedAt: reviewedAt,
                revokedAt: null,
              },
              create: {
                partnerId: existingRequest.partner.id,
                assetNetworkId: approvedCorridorAsset.id,
                status: PartnerProductionCorridorStatus.GRANTED,
                note:
                  reviewNote ??
                  existingRequest.requestNote ??
                  'Granted during production approval review.',
                grantedByIdentifier: 'admin-token',
                grantedAt: reviewedAt,
              },
            });
          }
        }

        await this.auditService.recordEvent(
          {
            actorType: AuditActorType.SYSTEM,
            actorIdentifier: 'admin-token',
            subjectPartnerId: existingRequest.partner.id,
            action: 'partner.production_approval.reviewed',
            entityType: 'PartnerProductionApprovalRequest',
            entityId: reviewedRequest.id,
            summary: `${reviewProductionApprovalRequestDto.decision === 'APPROVED' ? 'Approved' : 'Rejected'} production approval for '${existingRequest.partner.slug}'.`,
            metadata: {
              status: nextStatus,
              reviewNote,
              requestedCorridors: existingRequest.requestedCorridors.map(
                (requestedCorridor) => ({
                  assetNetworkId: requestedCorridor.assetNetwork.id,
                  chain: requestedCorridor.assetNetwork.chain.slug,
                  asset: requestedCorridor.assetNetwork.asset.symbol,
                }),
              ),
              approvedCorridors: approvedCorridorAssets.map(
                (approvedCorridor) => ({
                  assetNetworkId: approvedCorridor.id,
                  chain: approvedCorridor.chain.slug,
                  asset: approvedCorridor.asset.symbol,
                }),
              ),
            },
          },
          transaction,
        );

        if (nextStatus === ProductionApprovalRequestStatus.APPROVED) {
          await this.auditService.recordEvent(
            {
              actorType: AuditActorType.SYSTEM,
              actorIdentifier: 'admin-token',
              subjectPartnerId: existingRequest.partner.id,
              action: 'partner.production_enabled',
              entityType: 'Partner',
              entityId: existingRequest.partner.id,
              summary: `Enabled production access for '${existingRequest.partner.slug}'.`,
              metadata: {
                onboardingStage: PartnerOnboardingStage.PRODUCTION_APPROVED,
                approvedCorridors: approvedCorridorAssets.map(
                  (approvedCorridor) => ({
                    assetNetworkId: approvedCorridor.id,
                    chain: approvedCorridor.chain.slug,
                    asset: approvedCorridor.asset.symbol,
                  }),
                ),
              },
            },
            transaction,
          );
        }

        return reviewedRequest.id;
      },
    );

    return this.prismaService.partnerProductionApprovalRequest.findUniqueOrThrow(
      {
        where: {
          id: reviewedRequestId,
        },
        select: partnerProductionApprovalRequestSelect,
      },
    );
  }

  async updatePartnerAdminState(
    partnerId: string,
    updatePartnerAdminStateDto: UpdatePartnerAdminStateDto,
  ) {
    const trimmedPartnerId = partnerId.trim();

    if (trimmedPartnerId.length === 0) {
      throw new BadRequestException('Partner identifier is required.');
    }

    const existingPartner = await this.getPartnerByIdOrThrow(trimmedPartnerId);
    const nextDataPartnerEnabled =
      updatePartnerAdminStateDto.dataPartnerEnabled ??
      existingPartner.dataPartnerEnabled;
    const nextFullAttestationEnabled =
      updatePartnerAdminStateDto.fullAttestationPartnerEnabled ??
      existingPartner.fullAttestationPartnerEnabled;
    const nextOnboardingStage =
      updatePartnerAdminStateDto.onboardingStage ??
      existingPartner.onboardingStage;

    if (nextFullAttestationEnabled && !nextDataPartnerEnabled) {
      throw new BadRequestException(
        'Full attestation capability requires data partner capability to remain enabled.',
      );
    }

    if (
      existingPartner.productionEnabled &&
      nextOnboardingStage !== PartnerOnboardingStage.PRODUCTION_APPROVED
    ) {
      throw new BadRequestException(
        'Production-approved partners must remain in the production-approved onboarding stage.',
      );
    }

    if (
      !existingPartner.productionEnabled &&
      nextOnboardingStage === PartnerOnboardingStage.PRODUCTION_APPROVED
    ) {
      throw new BadRequestException(
        'Partners cannot enter the production-approved stage until production approval is granted.',
      );
    }

    const updateData: Prisma.PartnerUpdateInput = {};

    if (updatePartnerAdminStateDto.status !== undefined) {
      updateData.status = updatePartnerAdminStateDto.status;
    }

    if (updatePartnerAdminStateDto.onboardingStage !== undefined) {
      updateData.onboardingStage = updatePartnerAdminStateDto.onboardingStage;
    }

    if (updatePartnerAdminStateDto.feedHealthStatus !== undefined) {
      updateData.feedHealthStatus = updatePartnerAdminStateDto.feedHealthStatus;
    }

    if (updatePartnerAdminStateDto.apiConsumerEnabled !== undefined) {
      updateData.apiConsumerEnabled =
        updatePartnerAdminStateDto.apiConsumerEnabled;
    }

    if (updatePartnerAdminStateDto.dataPartnerEnabled !== undefined) {
      updateData.dataPartnerEnabled =
        updatePartnerAdminStateDto.dataPartnerEnabled;
    }

    if (
      updatePartnerAdminStateDto.fullAttestationPartnerEnabled !== undefined
    ) {
      updateData.fullAttestationPartnerEnabled =
        updatePartnerAdminStateDto.fullAttestationPartnerEnabled;
    }

    if (updatePartnerAdminStateDto.webhooksEnabled !== undefined) {
      updateData.webhooksEnabled = updatePartnerAdminStateDto.webhooksEnabled;
    }

    if (updatePartnerAdminStateDto.batchVerificationEnabled !== undefined) {
      updateData.batchVerificationEnabled =
        updatePartnerAdminStateDto.batchVerificationEnabled;
    }

    if (updatePartnerAdminStateDto.auditExportsEnabled !== undefined) {
      updateData.auditExportsEnabled =
        updatePartnerAdminStateDto.auditExportsEnabled;
    }

    if (updatePartnerAdminStateDto.sandboxEnabled !== undefined) {
      updateData.sandboxEnabled = updatePartnerAdminStateDto.sandboxEnabled;
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException(
        'At least one partner state field is required.',
      );
    }

    const updatedPartner = await this.prismaService.$transaction(
      async (transaction) => {
        const nextPartner = await transaction.partner.update({
          where: {
            id: existingPartner.id,
          },
          data: updateData,
          select: adminPartnerSelect,
        });

        await this.auditService.recordEvent(
          {
            actorType: AuditActorType.SYSTEM,
            actorIdentifier: 'admin-token',
            subjectPartnerId: existingPartner.id,
            action: 'partner.admin_state.updated',
            entityType: 'Partner',
            entityId: existingPartner.id,
            summary: `Updated admin-controlled state for '${existingPartner.slug}'.`,
            metadata: {
              previous: {
                status: existingPartner.status,
                onboardingStage: existingPartner.onboardingStage,
                feedHealthStatus: existingPartner.feedHealthStatus,
                apiConsumerEnabled: existingPartner.apiConsumerEnabled,
                dataPartnerEnabled: existingPartner.dataPartnerEnabled,
                fullAttestationPartnerEnabled:
                  existingPartner.fullAttestationPartnerEnabled,
                webhooksEnabled: existingPartner.webhooksEnabled,
                batchVerificationEnabled:
                  existingPartner.batchVerificationEnabled,
                auditExportsEnabled: existingPartner.auditExportsEnabled,
                sandboxEnabled: existingPartner.sandboxEnabled,
              },
              next: {
                status: nextPartner.status,
                onboardingStage: nextPartner.onboardingStage,
                feedHealthStatus: nextPartner.feedHealthStatus,
                apiConsumerEnabled: nextPartner.apiConsumerEnabled,
                dataPartnerEnabled: nextPartner.dataPartnerEnabled,
                fullAttestationPartnerEnabled:
                  nextPartner.fullAttestationPartnerEnabled,
                webhooksEnabled: nextPartner.webhooksEnabled,
                batchVerificationEnabled: nextPartner.batchVerificationEnabled,
                auditExportsEnabled: nextPartner.auditExportsEnabled,
                sandboxEnabled: nextPartner.sandboxEnabled,
              },
            },
          },
          transaction,
        );

        return nextPartner;
      },
    );

    return this.buildAdminPartnerWorkspaceRecord(updatedPartner);
  }

  async updatePartnerProductionCorridor(
    partnerId: string,
    updatePartnerProductionCorridorDto: UpdatePartnerProductionCorridorDto,
  ) {
    const trimmedPartnerId = partnerId.trim();
    const assetNetworkId =
      updatePartnerProductionCorridorDto.assetNetworkId.trim();

    if (trimmedPartnerId.length === 0) {
      throw new BadRequestException('Partner identifier is required.');
    }

    if (assetNetworkId.length === 0) {
      throw new BadRequestException('Asset-network corridor is required.');
    }

    const [partner, assetNetwork, existingCorridor] = await Promise.all([
      this.getPartnerByIdOrThrow(trimmedPartnerId),
      this.prismaService.assetNetwork.findFirst({
        where: {
          id: assetNetworkId,
          isActive: true,
          chain: {
            isActive: true,
          },
          asset: {
            isActive: true,
          },
        },
        select: corridorAssetNetworkSelect,
      }),
      this.prismaService.partnerProductionCorridor.findUnique({
        where: {
          partnerId_assetNetworkId: {
            partnerId: trimmedPartnerId,
            assetNetworkId,
          },
        },
        select: partnerProductionCorridorSelect,
      }),
    ]);

    if (!assetNetwork) {
      throw new NotFoundException(
        `Active asset-network corridor '${assetNetworkId}' was not found.`,
      );
    }

    if (!updatePartnerProductionCorridorDto.enabled && !existingCorridor) {
      throw new NotFoundException(
        'This partner does not currently have production access for the selected corridor.',
      );
    }

    const note = this.normalizeOptionalNote(
      updatePartnerProductionCorridorDto.note,
    );
    const now = new Date();

    return this.prismaService.$transaction(async (transaction) => {
      const corridor = existingCorridor
        ? await transaction.partnerProductionCorridor.update({
            where: {
              partnerId_assetNetworkId: {
                partnerId: trimmedPartnerId,
                assetNetworkId,
              },
            },
            data: {
              status: updatePartnerProductionCorridorDto.enabled
                ? PartnerProductionCorridorStatus.GRANTED
                : PartnerProductionCorridorStatus.REVOKED,
              note,
              grantedByIdentifier: 'admin-token',
              grantedAt: updatePartnerProductionCorridorDto.enabled
                ? now
                : existingCorridor.grantedAt,
              revokedAt: updatePartnerProductionCorridorDto.enabled
                ? null
                : now,
            },
            select: partnerProductionCorridorSelect,
          })
        : await transaction.partnerProductionCorridor.create({
            data: {
              partnerId: trimmedPartnerId,
              assetNetworkId,
              status: PartnerProductionCorridorStatus.GRANTED,
              note,
              grantedByIdentifier: 'admin-token',
              grantedAt: now,
            },
            select: partnerProductionCorridorSelect,
          });

      await this.auditService.recordEvent(
        {
          actorType: AuditActorType.SYSTEM,
          actorIdentifier: 'admin-token',
          subjectPartnerId: trimmedPartnerId,
          action: updatePartnerProductionCorridorDto.enabled
            ? 'partner.production_corridor.granted'
            : 'partner.production_corridor.revoked',
          entityType: 'PartnerProductionCorridor',
          entityId: corridor.id,
          summary: `${updatePartnerProductionCorridorDto.enabled ? 'Granted' : 'Revoked'} production corridor access for '${partner.slug}' on ${assetNetwork.chain.slug}/${assetNetwork.asset.symbol}.`,
          metadata: {
            assetNetworkId: assetNetwork.id,
            chain: assetNetwork.chain.slug,
            asset: assetNetwork.asset.symbol,
            note,
            status: corridor.status,
          },
        },
        transaction,
      );

      return corridor;
    });
  }

  async loginDashboardUser(loginDto: DashboardLoginDto) {
    const email = this.normalizeUserEmail(loginDto.email);
    const partnerUser = await this.prismaService.partnerUser.findUnique({
      where: {
        email,
      },
      include: {
        partner: true,
      },
    });

    if (
      !partnerUser ||
      partnerUser.status !== partnerUserStatusValues.ACTIVE ||
      partnerUser.disabledAt !== null ||
      partnerUser.partner.status !== PartnerStatus.ACTIVE ||
      !(await verifySecret(loginDto.password, partnerUser.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return this.createDashboardSessionForPartnerUser({
      partnerId: partnerUser.partnerId,
      partnerSlug: partnerUser.partner.slug,
      partnerDisplayName: partnerUser.partner.displayName,
      partnerUserId: partnerUser.id,
      email: partnerUser.email,
      fullName: partnerUser.fullName,
      role: partnerUser.role,
      scopes: partnerUser.scopes,
    });
  }

  async acceptPartnerUserInvite(
    inviteToken: string,
    acceptPartnerUserInviteDto: AcceptPartnerUserInviteDto,
  ) {
    const keyPrefix = extractPartnerUserInvitePrefix(inviteToken);

    if (!keyPrefix) {
      throw new UnauthorizedException('Invalid partner invite.');
    }

    const invite = await this.prismaService.partnerUserInvite.findUnique({
      where: {
        keyPrefix,
      },
      include: {
        partner: true,
      },
    });

    if (
      !invite ||
      invite.status !== PartnerUserInviteStatus.PENDING ||
      invite.revokedAt !== null ||
      invite.expiresAt <= new Date() ||
      invite.partner.status !== PartnerStatus.ACTIVE ||
      !(await verifyPartnerUserInviteToken(inviteToken, invite.secretHash))
    ) {
      throw new UnauthorizedException('Invalid partner invite.');
    }

    const existingUser = await this.prismaService.partnerUser.findUnique({
      where: {
        email: invite.email,
      },
    });

    if (existingUser) {
      throw new ConflictException(
        `Partner user '${invite.email}' already exists for dashboard access.`,
      );
    }

    const fullName =
      acceptPartnerUserInviteDto.fullName.trim().length > 0
        ? this.normalizeUserFullName(acceptPartnerUserInviteDto.fullName)
        : invite.fullName;

    if (!fullName) {
      throw new BadRequestException('Full name is required.');
    }

    this.assertValidDashboardPassword(acceptPartnerUserInviteDto.password);
    const passwordHash = hashSecret(acceptPartnerUserInviteDto.password);

    const generatedSession = generateDashboardSessionToken();
    const expiresAt = new Date(
      Date.now() +
        this.configService.get('PARTNER_DASHBOARD_SESSION_TTL_MS', {
          infer: true,
        }),
    );

    return this.prismaService.$transaction(async (transaction) => {
      const partnerUser = await transaction.partnerUser.create({
        data: {
          partnerId: invite.partnerId,
          email: invite.email,
          fullName,
          role: invite.role,
          scopes: invite.scopes,
          passwordHash,
          status: partnerUserStatusValues.ACTIVE,
          lastLoginAt: new Date(),
        },
        select: partnerUserSelect,
      });

      const session = await transaction.dashboardSession.create({
        data: {
          partnerUserId: partnerUser.id,
          keyPrefix: generatedSession.keyPrefix,
          secretHash: generatedSession.secretHash,
          expiresAt,
        },
        select: {
          id: true,
          expiresAt: true,
        },
      });

      await transaction.partnerUserInvite.update({
        where: {
          id: invite.id,
        },
        data: {
          status: PartnerUserInviteStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      });

      await this.auditService.recordEvent(
        {
          actorType: AuditActorType.USER,
          actorIdentifier: invite.email,
          subjectPartnerId: invite.partnerId,
          action: 'partner.user.invite.accepted',
          entityType: 'PartnerUserInvite',
          entityId: invite.id,
          summary: `Accepted dashboard invite for '${invite.email}'.`,
          metadata: {
            role: invite.role,
            expiresAt: invite.expiresAt.toISOString(),
          },
        },
        transaction,
      );

      await this.auditService.recordEvent(
        {
          actorType: AuditActorType.USER,
          actorIdentifier: invite.email,
          subjectPartnerId: invite.partnerId,
          action: 'partner.user.session.created',
          entityType: 'DashboardSession',
          entityId: session.id,
          summary: `Created a dashboard session for '${invite.email}'.`,
          metadata: {
            email: invite.email,
            role: invite.role,
            scopes: invite.scopes,
            expiresAt: session.expiresAt.toISOString(),
          },
        },
        transaction,
      );

      return {
        accessToken: generatedSession.secret,
        expiresAt: session.expiresAt.toISOString(),
        partner: {
          id: invite.partner.id,
          slug: invite.partner.slug,
          displayName: invite.partner.displayName,
        },
        user: {
          id: partnerUser.id,
          email: partnerUser.email,
          fullName: partnerUser.fullName,
          role: partnerUser.role,
          scopes: partnerUser.scopes,
          status: partnerUser.status,
          lastLoginAt: partnerUser.lastLoginAt?.toISOString() ?? null,
          createdAt: partnerUser.createdAt.toISOString(),
        },
      };
    });
  }

  async logoutDashboardSession(authenticatedPartner: AuthenticatedPartner) {
    if (
      !authenticatedPartner.dashboardSessionId ||
      !authenticatedPartner.partnerUserId
    ) {
      throw new UnauthorizedException('No dashboard session is active.');
    }

    const revokedAt = new Date();
    const revokedSessions =
      await this.prismaService.dashboardSession.updateMany({
        where: {
          id: authenticatedPartner.dashboardSessionId,
          partnerUserId: authenticatedPartner.partnerUserId,
          revokedAt: null,
        },
        data: {
          revokedAt,
        },
      });

    if (revokedSessions.count > 0) {
      await this.auditService.recordEvent({
        actorType: AuditActorType.USER,
        actorIdentifier: authenticatedPartner.actorIdentifier,
        subjectPartnerId: authenticatedPartner.partnerId,
        action: 'partner.user.session.revoked',
        entityType: 'DashboardSession',
        entityId: authenticatedPartner.dashboardSessionId,
        summary: `Revoked the active dashboard session for '${authenticatedPartner.actorIdentifier}'.`,
        metadata: {
          partnerUserId: authenticatedPartner.partnerUserId,
        },
      });
    }

    return {
      revoked: revokedSessions.count > 0,
    };
  }

  async getPartnerProfile(authenticatedPartner: AuthenticatedPartner) {
    const [
      partner,
      counts,
      authenticatedUser,
      latestProductionApprovalRequest,
      productionCorridors,
    ] = await Promise.all([
      this.getPartnerByIdOrThrow(authenticatedPartner.partnerId),
      this.getPartnerOperationalCounts(authenticatedPartner.partnerId),
      authenticatedPartner.partnerUserId
        ? this.prismaService.partnerUser.findFirst({
            where: {
              id: authenticatedPartner.partnerUserId,
              partnerId: authenticatedPartner.partnerId,
            },
            select: partnerUserSelect,
          })
        : Promise.resolve(null),
      this.getLatestProductionApprovalRequest(authenticatedPartner.partnerId),
      this.listGrantedProductionCorridors(authenticatedPartner.partnerId),
    ]);

    return {
      id: partner.id,
      slug: partner.slug,
      displayName: partner.displayName,
      partnerType: partner.partnerType,
      status: partner.status,
      createdAt: partner.createdAt,
      activeCredentialCount: counts.activeCredentialCount,
      activeSigningKeyCount: counts.activeSigningKeyCount,
      capabilities: this.buildPartnerCapabilities(partner),
      onboarding: this.buildPartnerOnboardingSummary(
        partner,
        counts,
        latestProductionApprovalRequest,
      ),
      readiness: this.buildPartnerReadinessSummary(
        partner,
        latestProductionApprovalRequest,
        productionCorridors.length,
      ),
      productionAccess:
        this.buildPartnerProductionAccessSummary(productionCorridors),
      productionApproval: this.buildPartnerProductionApprovalSummary(
        authenticatedPartner,
        authenticatedUser,
        partner,
        counts,
        latestProductionApprovalRequest,
      ),
      authenticatedActor: {
        type: authenticatedPartner.actorType,
        identifier: authenticatedPartner.actorIdentifier,
        scopes: authenticatedPartner.scopes,
      },
      authenticatedCredential: authenticatedPartner.credentialId
        ? {
            id: authenticatedPartner.credentialId,
            scopes: authenticatedPartner.scopes,
          }
        : null,
      authenticatedUser,
    };
  }

  async issueApiCredential(createApiCredentialDto: CreateApiCredentialDto) {
    const partner = await this.getPartnerBySlugOrThrow(
      createApiCredentialDto.partnerSlug,
    );

    return this.issueApiCredentialForPartner(partner, createApiCredentialDto, {
      actorType: AuditActorType.SYSTEM,
      actorIdentifier: 'admin-token',
    });
  }

  async listPartnerApiCredentials(authenticatedPartner: AuthenticatedPartner) {
    const credentials = await this.prismaService.partnerApiCredential.findMany({
      where: {
        partnerId: authenticatedPartner.partnerId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: partnerApiCredentialSelect,
    });

    return credentials.map((credential) => ({
      ...credential,
      isCurrent:
        authenticatedPartner.credentialId !== null &&
        credential.id === authenticatedPartner.credentialId,
    }));
  }

  async issuePartnerApiCredential(
    authenticatedPartner: AuthenticatedPartner,
    createApiCredentialDto: CreateSelfServiceApiCredentialDto,
  ) {
    const partner = await this.getPartnerByIdOrThrow(
      authenticatedPartner.partnerId,
    );

    return this.issueApiCredentialForPartner(
      partner,
      createApiCredentialDto,
      this.buildPartnerAuditContext(authenticatedPartner),
    );
  }

  async revokePartnerApiCredential(
    authenticatedPartner: AuthenticatedPartner,
    credentialId: string,
  ) {
    const trimmedCredentialId = credentialId.trim();

    if (trimmedCredentialId.length === 0) {
      throw new BadRequestException('Credential identifier is required.');
    }

    if (trimmedCredentialId === authenticatedPartner.credentialId) {
      throw new ConflictException(
        'Cannot revoke the credential currently used by this session.',
      );
    }

    const credential = await this.prismaService.partnerApiCredential.findFirst({
      where: {
        id: trimmedCredentialId,
        partnerId: authenticatedPartner.partnerId,
      },
      select: partnerApiCredentialSelect,
    });

    if (!credential) {
      throw new NotFoundException(
        `Credential '${trimmedCredentialId}' was not found for this partner.`,
      );
    }

    if (
      credential.status !== PartnerStatus.ACTIVE ||
      credential.revokedAt !== null
    ) {
      throw new ConflictException(
        `Credential '${credential.label}' is already inactive.`,
      );
    }

    return this.prismaService.$transaction(async (transaction) => {
      const revokedCredential = await transaction.partnerApiCredential.update({
        where: {
          id: credential.id,
        },
        data: {
          status: PartnerStatus.DISABLED,
          revokedAt: new Date(),
        },
        select: partnerApiCredentialSelect,
      });

      await this.auditService.recordEvent(
        {
          ...this.buildPartnerAuditContext(authenticatedPartner),
          subjectPartnerId: authenticatedPartner.partnerId,
          action: 'partner.api_credential.revoked',
          entityType: 'PartnerApiCredential',
          entityId: revokedCredential.id,
          summary: `Revoked API credential '${revokedCredential.label}' for partner '${authenticatedPartner.partnerSlug}'.`,
          metadata: {
            keyPrefix: revokedCredential.keyPrefix,
            label: revokedCredential.label,
            scopes: revokedCredential.scopes,
          },
        },
        transaction,
      );

      return {
        ...revokedCredential,
        isCurrent: false,
      };
    });
  }

  async registerSigningKey(registerSigningKeyDto: RegisterSigningKeyDto) {
    const partner = await this.getPartnerBySlugOrThrow(
      registerSigningKeyDto.partnerSlug,
    );

    return this.registerSigningKeyForPartner(partner, registerSigningKeyDto, {
      actorType: AuditActorType.SYSTEM,
      actorIdentifier: 'admin-token',
    });
  }

  async listPartnerSigningKeys(partnerId: string) {
    return this.prismaService.partnerSigningKey.findMany({
      where: {
        partnerId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: partnerSigningKeySelect,
    });
  }

  async registerPartnerSigningKey(
    authenticatedPartner: AuthenticatedPartner,
    registerSigningKeyDto: RegisterSelfServiceSigningKeyDto,
  ) {
    const partner = await this.getPartnerByIdOrThrow(
      authenticatedPartner.partnerId,
    );

    return this.registerSigningKeyForPartner(
      partner,
      registerSigningKeyDto,
      this.buildPartnerAuditContext(authenticatedPartner),
    );
  }

  async revokePartnerSigningKey(
    authenticatedPartner: AuthenticatedPartner,
    signingKeyId: string,
  ) {
    const trimmedSigningKeyId = signingKeyId.trim();

    if (trimmedSigningKeyId.length === 0) {
      throw new BadRequestException('Signing key identifier is required.');
    }

    const signingKey = await this.prismaService.partnerSigningKey.findFirst({
      where: {
        id: trimmedSigningKeyId,
        partnerId: authenticatedPartner.partnerId,
      },
      select: partnerSigningKeySelect,
    });

    if (!signingKey) {
      throw new NotFoundException(
        `Signing key '${trimmedSigningKeyId}' was not found for this partner.`,
      );
    }

    if (
      signingKey.status !== SigningKeyStatus.ACTIVE ||
      signingKey.revokedAt !== null
    ) {
      throw new ConflictException(
        `Signing key '${signingKey.keyId}' is already inactive.`,
      );
    }

    const activeSigningKeyCount =
      await this.prismaService.partnerSigningKey.count({
        where: {
          partnerId: authenticatedPartner.partnerId,
          revokedAt: null,
          status: SigningKeyStatus.ACTIVE,
        },
      });

    if (activeSigningKeyCount <= 1) {
      throw new ConflictException('Cannot revoke the last active signing key.');
    }

    return this.prismaService.$transaction(async (transaction) => {
      const revokedSigningKey = await transaction.partnerSigningKey.update({
        where: {
          id: signingKey.id,
        },
        data: {
          status: SigningKeyStatus.REVOKED,
          revokedAt: new Date(),
        },
        select: partnerSigningKeySelect,
      });

      await this.auditService.recordEvent(
        {
          ...this.buildPartnerAuditContext(authenticatedPartner),
          subjectPartnerId: authenticatedPartner.partnerId,
          action: 'partner.signing_key.revoked',
          entityType: 'PartnerSigningKey',
          entityId: revokedSigningKey.id,
          summary: `Revoked signing key '${revokedSigningKey.keyId}' for partner '${authenticatedPartner.partnerSlug}'.`,
          metadata: {
            algorithm: revokedSigningKey.algorithm,
            fingerprint: revokedSigningKey.fingerprint,
            keyId: revokedSigningKey.keyId,
          },
        },
        transaction,
      );

      return revokedSigningKey;
    });
  }

  async getPartnerBySlug(slug: string) {
    return this.prismaService.partner.findUnique({
      where: {
        slug: this.normalizationService.normalizePartnerSlug(slug),
      },
    });
  }

  async getActiveSigningKey(partnerId: string, keyId: string) {
    const signingKey = await this.prismaService.partnerSigningKey.findUnique({
      where: {
        partnerId_keyId: {
          partnerId,
          keyId: keyId.trim(),
        },
      },
    });

    if (!signingKey) {
      throw new NotFoundException(`Signing key '${keyId}' was not found.`);
    }

    const now = new Date();

    if (signingKey.status !== SigningKeyStatus.ACTIVE) {
      throw new ConflictException(`Signing key '${keyId}' is not active.`);
    }

    if (signingKey.validTo && signingKey.validTo <= now) {
      throw new ConflictException(`Signing key '${keyId}' has expired.`);
    }

    return signingKey;
  }

  async authenticateApiCredential(
    secret: string,
    requiredScopes: readonly string[],
  ): Promise<AuthenticatedPartner> {
    const keyPrefix = extractApiCredentialPrefix(secret);

    if (!keyPrefix) {
      throw new UnauthorizedException('Invalid API credential.');
    }

    const apiCredential =
      await this.prismaService.partnerApiCredential.findUnique({
        where: { keyPrefix },
        include: {
          partner: true,
        },
      });

    if (
      !apiCredential ||
      apiCredential.status !== PartnerStatus.ACTIVE ||
      apiCredential.revokedAt !== null ||
      apiCredential.partner.status !== PartnerStatus.ACTIVE ||
      !(await verifyApiCredentialSecret(secret, apiCredential.secretHash))
    ) {
      throw new UnauthorizedException('Invalid API credential.');
    }

    const missingScopes = requiredScopes.filter(
      (scope) => !apiCredential.scopes.includes(scope),
    );

    if (missingScopes.length > 0) {
      throw new ForbiddenException(
        'Credential does not have the required scope.',
      );
    }

    await this.maybeRecordCredentialUse(apiCredential.id);

    return {
      actorIdentifier: apiCredential.id,
      actorType: 'API_CREDENTIAL',
      credentialId: apiCredential.id,
      dashboardSessionId: null,
      partnerId: apiCredential.partnerId,
      partnerSlug: apiCredential.partner.slug,
      partnerStatus: apiCredential.partner.status,
      partnerCapabilities: this.buildPartnerCapabilities(apiCredential.partner),
      partnerFeedHealthStatus: apiCredential.partner.feedHealthStatus,
      partnerOnboardingStage: apiCredential.partner.onboardingStage,
      partnerUserEmail: null,
      partnerUserId: null,
      partnerUserRole: null,
      scopes: apiCredential.scopes,
    };
  }

  async authenticatePartnerAccessToken(
    secret: string,
    requiredScopes: readonly string[],
  ): Promise<AuthenticatedPartner> {
    if (extractDashboardSessionPrefix(secret)) {
      return this.authenticateDashboardSession(secret, requiredScopes);
    }

    return this.authenticateApiCredential(secret, requiredScopes);
  }

  private async issueApiCredentialForPartner(
    partner: Partner,
    createApiCredentialDto: IssueCredentialInput,
    auditActorContext: AuditActorContext,
  ) {
    if (partner.status !== PartnerStatus.ACTIVE) {
      throw new ConflictException(
        `Partner '${partner.slug}' is not active for credential issuance.`,
      );
    }

    const label = createApiCredentialDto.label.trim();

    if (label.length === 0) {
      throw new BadRequestException('Credential label is required.');
    }

    const scopes = normalizeCredentialScopes(
      createApiCredentialDto.scopes ?? defaultCredentialScopes,
    );

    if (scopes.length === 0) {
      throw new BadRequestException(
        'At least one supported scope is required.',
      );
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const generatedCredential = generateApiCredential();

      try {
        const apiCredential = await this.prismaService.$transaction(
          async (transaction) => {
            const createdCredential =
              await transaction.partnerApiCredential.create({
                data: {
                  partnerId: partner.id,
                  label,
                  keyPrefix: generatedCredential.keyPrefix,
                  secretHash: generatedCredential.secretHash,
                  scopes,
                  status: PartnerStatus.ACTIVE,
                },
                select: {
                  ...partnerApiCredentialSelect,
                },
              });

            await this.auditService.recordEvent(
              {
                actorType: auditActorContext.actorType,
                actorPartnerId: auditActorContext.actorPartnerId ?? null,
                actorIdentifier: auditActorContext.actorIdentifier,
                subjectPartnerId: partner.id,
                action: 'partner.api_credential.issued',
                entityType: 'PartnerApiCredential',
                entityId: createdCredential.id,
                summary: `Issued API credential '${createdCredential.label}' for partner '${partner.slug}'.`,
                metadata: {
                  keyPrefix: createdCredential.keyPrefix,
                  partnerSlug: partner.slug,
                  scopes: createdCredential.scopes,
                },
              },
              transaction,
            );

            return createdCredential;
          },
        );

        return {
          ...apiCredential,
          isCurrent: false,
          partner: partner.slug,
          secret: generatedCredential.secret,
        };
      } catch (error: unknown) {
        if (this.isUniqueConstraintError(error)) {
          continue;
        }

        throw error;
      }
    }

    throw new ConflictException('Failed to generate a unique API credential.');
  }

  private async registerSigningKeyForPartner(
    partner: Partner,
    registerSigningKeyDto: RegisterKeyInput,
    auditActorContext: AuditActorContext,
  ) {
    if (partner.status !== PartnerStatus.ACTIVE) {
      throw new ConflictException(
        `Partner '${partner.slug}' is not active for signing-key registration.`,
      );
    }

    const keyId = registerSigningKeyDto.keyId.trim();

    if (keyId.length === 0) {
      throw new BadRequestException('Signing key identifier is required.');
    }

    const existingKey = await this.prismaService.partnerSigningKey.findUnique({
      where: {
        partnerId_keyId: {
          partnerId: partner.id,
          keyId,
        },
      },
    });

    if (existingKey) {
      throw new ConflictException(
        `Key '${keyId}' is already registered for partner '${partner.slug}'.`,
      );
    }

    const publicKeyPem = registerSigningKeyDto.publicKeyPem.trim();

    if (publicKeyPem.length === 0) {
      throw new BadRequestException('Public key PEM is required.');
    }

    this.assertValidPublicKey(publicKeyPem);

    const validFrom = new Date(registerSigningKeyDto.validFrom);
    const validTo = registerSigningKeyDto.validTo
      ? new Date(registerSigningKeyDto.validTo)
      : null;

    if (validTo && validTo <= validFrom) {
      throw new BadRequestException('Signing key validity window is invalid.');
    }

    return this.prismaService.$transaction(async (transaction) => {
      const signingKey = await transaction.partnerSigningKey.create({
        data: {
          partnerId: partner.id,
          keyId,
          algorithm: registerSigningKeyDto.algorithm,
          publicKeyPem,
          fingerprint: createHash('sha256').update(publicKeyPem).digest('hex'),
          status: SigningKeyStatus.ACTIVE,
          validFrom,
          validTo,
        },
        select: partnerSigningKeySelect,
      });

      await this.auditService.recordEvent(
        {
          actorType: auditActorContext.actorType,
          actorPartnerId: auditActorContext.actorPartnerId ?? null,
          actorIdentifier: auditActorContext.actorIdentifier,
          subjectPartnerId: partner.id,
          action: 'partner.signing_key.registered',
          entityType: 'PartnerSigningKey',
          entityId: signingKey.id,
          summary: `Registered signing key '${signingKey.keyId}' for partner '${partner.slug}'.`,
          metadata: {
            algorithm: signingKey.algorithm,
            fingerprint: signingKey.fingerprint,
            keyId: signingKey.keyId,
            partnerSlug: partner.slug,
          },
        },
        transaction,
      );

      return signingKey;
    });
  }

  private async authenticateDashboardSession(
    secret: string,
    requiredScopes: readonly string[],
  ): Promise<AuthenticatedPartner> {
    const keyPrefix = extractDashboardSessionPrefix(secret);

    if (!keyPrefix) {
      throw new UnauthorizedException('Invalid dashboard session.');
    }

    const dashboardSession =
      await this.prismaService.dashboardSession.findUnique({
        where: {
          keyPrefix,
        },
        include: {
          partnerUser: {
            include: {
              partner: true,
            },
          },
        },
      });

    if (
      !dashboardSession ||
      dashboardSession.revokedAt !== null ||
      dashboardSession.expiresAt <= new Date() ||
      dashboardSession.partnerUser.status !== partnerUserStatusValues.ACTIVE ||
      dashboardSession.partnerUser.disabledAt !== null ||
      dashboardSession.partnerUser.partner.status !== PartnerStatus.ACTIVE ||
      !(await verifyDashboardSessionToken(secret, dashboardSession.secretHash))
    ) {
      throw new UnauthorizedException('Invalid dashboard session.');
    }

    const missingScopes = requiredScopes.filter(
      (scope) => !dashboardSession.partnerUser.scopes.includes(scope),
    );

    if (missingScopes.length > 0) {
      throw new ForbiddenException('Session does not have the required scope.');
    }

    await this.maybeRecordDashboardSessionUse(dashboardSession.id);

    return {
      actorIdentifier: dashboardSession.partnerUser.email,
      actorType: 'PARTNER_USER',
      credentialId: null,
      dashboardSessionId: dashboardSession.id,
      partnerId: dashboardSession.partnerUser.partnerId,
      partnerSlug: dashboardSession.partnerUser.partner.slug,
      partnerStatus: dashboardSession.partnerUser.partner.status,
      partnerCapabilities: this.buildPartnerCapabilities(
        dashboardSession.partnerUser.partner,
      ),
      partnerFeedHealthStatus:
        dashboardSession.partnerUser.partner.feedHealthStatus,
      partnerOnboardingStage:
        dashboardSession.partnerUser.partner.onboardingStage,
      partnerUserEmail: dashboardSession.partnerUser.email,
      partnerUserId: dashboardSession.partnerUser.id,
      partnerUserRole: dashboardSession.partnerUser.role,
      scopes: dashboardSession.partnerUser.scopes,
    };
  }

  private async createDashboardSessionForPartnerUser(params: {
    partnerId: string;
    partnerSlug: string;
    partnerDisplayName: string;
    partnerUserId: string;
    email: string;
    fullName: string;
    role: PartnerUserRole;
    scopes: string[];
  }) {
    const generatedSession = generateDashboardSessionToken();
    const expiresAt = new Date(
      Date.now() +
        this.configService.get('PARTNER_DASHBOARD_SESSION_TTL_MS', {
          infer: true,
        }),
    );

    const session = await this.prismaService.$transaction(
      async (transaction) => {
        const createdSession = await transaction.dashboardSession.create({
          data: {
            partnerUserId: params.partnerUserId,
            keyPrefix: generatedSession.keyPrefix,
            secretHash: generatedSession.secretHash,
            expiresAt,
          },
          select: {
            id: true,
            expiresAt: true,
          },
        });

        await transaction.partnerUser.update({
          where: {
            id: params.partnerUserId,
          },
          data: {
            lastLoginAt: new Date(),
          },
        });

        await this.auditService.recordEvent(
          {
            actorType: AuditActorType.USER,
            actorIdentifier: params.email,
            subjectPartnerId: params.partnerId,
            action: 'partner.user.session.created',
            entityType: 'DashboardSession',
            entityId: createdSession.id,
            summary: `Created a dashboard session for '${params.email}'.`,
            metadata: {
              email: params.email,
              role: params.role,
              scopes: params.scopes,
              expiresAt: createdSession.expiresAt.toISOString(),
            },
          },
          transaction,
        );

        return createdSession;
      },
    );

    return {
      accessToken: generatedSession.secret,
      expiresAt: session.expiresAt.toISOString(),
      partner: {
        id: params.partnerId,
        slug: params.partnerSlug,
        displayName: params.partnerDisplayName,
      },
      user: {
        id: params.partnerUserId,
        email: params.email,
        fullName: params.fullName,
        role: params.role,
        scopes: params.scopes,
      },
    };
  }

  private async getOrCreatePartnerSecuritySettings(partnerId: string) {
    const existingSettings =
      await this.prismaService.partnerSecuritySettings.findUnique({
        where: {
          partnerId,
        },
        select: partnerSecuritySettingsSelect,
      });

    if (existingSettings) {
      return existingSettings;
    }

    return this.prismaService.partnerSecuritySettings.create({
      data: {
        partnerId,
        sessionIdleTimeoutMinutes: this.configService.get(
          'PARTNER_SECURITY_DEFAULT_SESSION_IDLE_TIMEOUT_MINUTES',
          {
            infer: true,
          },
        ),
        credentialRotationDays: this.configService.get(
          'PARTNER_SECURITY_DEFAULT_CREDENTIAL_ROTATION_DAYS',
          {
            infer: true,
          },
        ),
      },
      select: partnerSecuritySettingsSelect,
    });
  }

  private async getPartnerBySlugOrThrow(slug: string) {
    const partner = await this.prismaService.partner.findUnique({
      where: {
        slug: this.normalizationService.normalizePartnerSlug(slug),
      },
    });

    if (!partner) {
      throw new NotFoundException(
        `Partner '${this.normalizationService.normalizePartnerSlug(slug)}' does not exist. Register the partner first.`,
      );
    }

    return partner;
  }

  private async getPartnerByIdOrThrow(partnerId: string) {
    const partner = await this.prismaService.partner.findUnique({
      where: {
        id: partnerId,
      },
    });

    if (!partner) {
      throw new NotFoundException(`Partner '${partnerId}' was not found.`);
    }

    return partner;
  }

  private async getPartnerOperationalCounts(
    partnerId: string,
  ): Promise<PartnerOperationalCounts> {
    const [
      activeCredentialCount,
      activeSigningKeyCount,
      activeWebhookCount,
      activeRecipientCount,
      verifiedAttestationCount,
      resolutionRequestCount,
    ] = await Promise.all([
      this.prismaService.partnerApiCredential.count({
        where: {
          partnerId,
          revokedAt: null,
          status: PartnerStatus.ACTIVE,
        },
      }),
      this.prismaService.partnerSigningKey.count({
        where: {
          partnerId,
          revokedAt: null,
          status: SigningKeyStatus.ACTIVE,
        },
      }),
      this.prismaService.webhookEndpoint.count({
        where: {
          partnerId,
          status: {
            in: [WebhookStatus.ACTIVE, WebhookStatus.PAUSED],
          },
        },
      }),
      this.prismaService.recipient.count({
        where: {
          partnerId,
          status: RecipientStatus.ACTIVE,
        },
      }),
      this.prismaService.attestation.count({
        where: {
          partnerId,
          verificationStatus: VerificationStatus.VERIFIED,
        },
      }),
      this.prismaService.resolutionRequest.count({
        where: {
          requesterPartnerId: partnerId,
        },
      }),
    ]);

    return {
      activeCredentialCount,
      activeSigningKeyCount,
      activeWebhookCount,
      activeRecipientCount,
      verifiedAttestationCount,
      resolutionRequestCount,
    };
  }

  private async getLatestProductionApprovalRequest(
    partnerId: string,
  ): Promise<PartnerProductionApprovalRequestRecord | null> {
    return this.prismaService.partnerProductionApprovalRequest.findFirst({
      where: {
        partnerId,
      },
      orderBy: {
        requestedAt: 'desc',
      },
      select: partnerProductionApprovalRequestSelect,
    });
  }

  private async listGrantedProductionCorridors(partnerId: string) {
    return this.prismaService.partnerProductionCorridor.findMany({
      where: {
        partnerId,
        status: PartnerProductionCorridorStatus.GRANTED,
      },
      orderBy: [
        {
          assetNetwork: {
            chain: {
              displayName: 'asc',
            },
          },
        },
        {
          assetNetwork: {
            asset: {
              displayName: 'asc',
            },
          },
        },
      ],
      select: partnerProductionCorridorSelect,
    });
  }

  private normalizeRequestedAssetNetworkIds(assetNetworkIds?: string[]) {
    if (!assetNetworkIds) {
      return [];
    }

    const trimmedValues = assetNetworkIds
      .map((assetNetworkId) => assetNetworkId.trim())
      .filter((assetNetworkId) => assetNetworkId.length > 0);

    return [...new Set(trimmedValues)];
  }

  private async getActiveAssetNetworksByIds(assetNetworkIds: string[]) {
    const corridors = await this.prismaService.assetNetwork.findMany({
      where: {
        id: {
          in: assetNetworkIds,
        },
        isActive: true,
        chain: {
          isActive: true,
        },
        asset: {
          isActive: true,
        },
      },
      select: corridorAssetNetworkSelect,
    });

    if (corridors.length !== assetNetworkIds.length) {
      throw new BadRequestException(
        'One or more requested production corridors are invalid or inactive.',
      );
    }

    return corridors;
  }

  private async buildAdminPartnerWorkspaceRecord(partner: AdminPartnerRecord) {
    const [counts, latestProductionApprovalRequest, productionCorridors] =
      await Promise.all([
        this.getPartnerOperationalCounts(partner.id),
        this.getLatestProductionApprovalRequest(partner.id),
        this.listGrantedProductionCorridors(partner.id),
      ]);

    return {
      id: partner.id,
      slug: partner.slug,
      displayName: partner.displayName,
      partnerType: partner.partnerType,
      status: partner.status,
      createdAt: partner.createdAt,
      updatedAt: partner.updatedAt,
      capabilities: this.buildPartnerCapabilities(partner as Partner),
      onboarding: this.buildPartnerOnboardingSummary(
        partner as Partner,
        counts,
        latestProductionApprovalRequest,
      ),
      readiness: this.buildPartnerReadinessSummary(
        partner as Partner,
        latestProductionApprovalRequest,
        productionCorridors.length,
      ),
      productionAccess:
        this.buildPartnerProductionAccessSummary(productionCorridors),
      counts,
      latestProductionApprovalRequest,
    };
  }

  private async assertProductionApprovalAccess(
    authenticatedPartner: AuthenticatedPartner,
  ): Promise<void> {
    if (
      authenticatedPartner.actorType !== 'PARTNER_USER' ||
      !authenticatedPartner.partnerUserId
    ) {
      throw new ForbiddenException(
        'Production approval requests require a dashboard user session.',
      );
    }

    const partnerUser = await this.prismaService.partnerUser.findFirst({
      where: {
        id: authenticatedPartner.partnerUserId,
        partnerId: authenticatedPartner.partnerId,
        status: partnerUserStatusValues.ACTIVE,
        disabledAt: null,
      },
      select: {
        role: true,
      },
    });

    if (!partnerUser) {
      throw new ForbiddenException(
        'The active dashboard user could not be resolved for this partner.',
      );
    }

    if (
      partnerUser.role !== PartnerUserRole.OWNER &&
      partnerUser.role !== PartnerUserRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Only owners and admins can change production approval state.',
      );
    }
  }

  private buildPartnerAuditContext(
    authenticatedPartner: AuthenticatedPartner,
  ): AuditActorContext {
    return {
      actorType:
        authenticatedPartner.actorType === 'PARTNER_USER'
          ? AuditActorType.USER
          : AuditActorType.PARTNER,
      actorPartnerId: authenticatedPartner.partnerId,
      actorIdentifier: authenticatedPartner.actorIdentifier,
    };
  }

  private buildPartnerCapabilities(partner: Partner) {
    return {
      apiConsumerEnabled: partner.apiConsumerEnabled,
      dataPartnerEnabled: partner.dataPartnerEnabled,
      fullAttestationPartnerEnabled: partner.fullAttestationPartnerEnabled,
      webhooksEnabled: partner.webhooksEnabled,
      batchVerificationEnabled: partner.batchVerificationEnabled,
      auditExportsEnabled: partner.auditExportsEnabled,
      sandboxEnabled: partner.sandboxEnabled,
      productionEnabled: partner.productionEnabled,
      profileLabel: this.resolvePartnerCapabilityLabel(partner),
    };
  }

  private isDataContributorPartner(
    partner: Pick<
      Partner,
      'dataPartnerEnabled' | 'fullAttestationPartnerEnabled'
    >,
  ): boolean {
    return partner.dataPartnerEnabled || partner.fullAttestationPartnerEnabled;
  }

  private buildPartnerOnboardingSummary(
    partner: Partner,
    counts: PartnerOperationalCounts,
    latestProductionApprovalRequest: PartnerProductionApprovalRequestRecord | null,
  ) {
    const nextRecommendedAction = this.resolveNextRecommendedAction(
      partner,
      counts,
      latestProductionApprovalRequest,
    );
    const completedTasks = [
      counts.activeCredentialCount > 0 ? 'create_api_key' : null,
      counts.activeSigningKeyCount > 0 ? 'register_signing_key' : null,
      counts.activeWebhookCount > 0 ? 'configure_webhook' : null,
      counts.resolutionRequestCount > 0 ? 'run_sandbox_request' : null,
      counts.activeRecipientCount > 0 ? 'map_recipient_data' : null,
      counts.verifiedAttestationCount > 0 ? 'ingest_attestation_data' : null,
      latestProductionApprovalRequest?.status ===
      ProductionApprovalRequestStatus.PENDING
        ? 'request_production_approval'
        : null,
      partner.productionEnabled ? 'production_enabled' : null,
    ].filter((task): task is string => task !== null);

    const blockedTasks = [
      !partner.apiConsumerEnabled ? 'api_consumer_capability_disabled' : null,
      !this.isDataContributorPartner(partner)
        ? 'data_partner_capability_disabled'
        : null,
      !partner.webhooksEnabled ? 'webhooks_capability_disabled' : null,
      !partner.sandboxEnabled ? 'sandbox_capability_disabled' : null,
      latestProductionApprovalRequest?.status ===
      ProductionApprovalRequestStatus.PENDING
        ? 'production_approval_pending'
        : null,
    ].filter((task): task is string => task !== null);

    return {
      stage: partner.onboardingStage,
      completedTasks,
      blockedTasks,
      nextRecommendedAction,
      nextRecommendedActionLabel: this.describeOnboardingAction(
        nextRecommendedAction,
      ),
    };
  }

  private buildPartnerReadinessSummary(
    partner: Partner,
    latestProductionApprovalRequest: PartnerProductionApprovalRequestRecord | null,
    approvedCorridorCount: number,
  ) {
    const environment = partner.productionEnabled
      ? 'PRODUCTION_APPROVED'
      : partner.sandboxEnabled
        ? 'SANDBOX_ONLY'
        : 'RESTRICTED';

    return {
      environment,
      productionEnabled: partner.productionEnabled,
      feedHealthStatus: partner.feedHealthStatus,
      approvedCorridorCount,
      statusLabel: this.resolveReadinessLabel(
        partner,
        environment,
        latestProductionApprovalRequest,
        approvedCorridorCount,
      ),
    };
  }

  private resolvePartnerCapabilityLabel(partner: Partner): string {
    if (partner.fullAttestationPartnerEnabled) {
      return 'FULL_ATTESTATION_PARTNER';
    }

    if (partner.apiConsumerEnabled && partner.dataPartnerEnabled) {
      return 'CONSUMER_AND_DATA_PARTNER';
    }

    if (partner.dataPartnerEnabled) {
      return 'DATA_PARTNER';
    }

    if (partner.apiConsumerEnabled) {
      return 'API_CONSUMER';
    }

    return 'LIMITED_PARTNER';
  }

  private resolveReadinessLabel(
    partner: Partner,
    environment: 'SANDBOX_ONLY' | 'PRODUCTION_APPROVED' | 'RESTRICTED',
    latestProductionApprovalRequest: PartnerProductionApprovalRequestRecord | null,
    approvedCorridorCount: number,
  ): string {
    if (environment === 'PRODUCTION_APPROVED') {
      if (approvedCorridorCount === 0) {
        return 'Production approved with no active production corridors';
      }

      return partner.feedHealthStatus === PartnerFeedHealthStatus.DEGRADED
        ? `Production live with degraded feed health across ${approvedCorridorCount} corridor${approvedCorridorCount === 1 ? '' : 's'}`
        : `Production approved across ${approvedCorridorCount} corridor${approvedCorridorCount === 1 ? '' : 's'}`;
    }

    if (
      latestProductionApprovalRequest?.status ===
      ProductionApprovalRequestStatus.PENDING
    ) {
      return 'Pending production review';
    }

    if (
      latestProductionApprovalRequest?.status ===
      ProductionApprovalRequestStatus.REJECTED
    ) {
      return 'Production review changes requested';
    }

    if (environment === 'SANDBOX_ONLY') {
      return 'Sandbox only';
    }

    return 'Restricted setup';
  }

  private buildPartnerProductionAccessSummary(
    productionCorridors: PartnerProductionCorridorRecord[],
  ) {
    return {
      approvedCorridorCount: productionCorridors.length,
      approvedCorridors: productionCorridors,
    };
  }

  private resolveNextRecommendedAction(
    partner: Partner,
    counts: PartnerOperationalCounts,
    latestProductionApprovalRequest: PartnerProductionApprovalRequestRecord | null,
  ): string | null {
    if (
      latestProductionApprovalRequest?.status ===
      ProductionApprovalRequestStatus.PENDING
    ) {
      return 'await_production_review';
    }

    if (partner.apiConsumerEnabled && counts.activeCredentialCount === 0) {
      return 'create_api_key';
    }

    if (
      (partner.dataPartnerEnabled || partner.fullAttestationPartnerEnabled) &&
      counts.activeSigningKeyCount === 0
    ) {
      return 'register_signing_key';
    }

    if (partner.webhooksEnabled && counts.activeWebhookCount === 0) {
      return 'configure_webhook';
    }

    if (partner.apiConsumerEnabled && counts.resolutionRequestCount === 0) {
      return 'run_sandbox_request';
    }

    if (
      this.isDataContributorPartner(partner) &&
      counts.activeRecipientCount === 0
    ) {
      return 'map_recipient_data';
    }

    if (
      this.isDataContributorPartner(partner) &&
      counts.verifiedAttestationCount === 0
    ) {
      return 'ingest_attestation_data';
    }

    if (!partner.productionEnabled) {
      return 'request_production_approval';
    }

    return null;
  }

  private buildPartnerProductionApprovalSummary(
    authenticatedPartner: AuthenticatedPartner,
    authenticatedUser: Prisma.PartnerUserGetPayload<{
      select: typeof partnerUserSelect;
    }> | null,
    partner: Partner,
    counts: PartnerOperationalCounts,
    latestProductionApprovalRequest: PartnerProductionApprovalRequestRecord | null,
  ) {
    const nextAction = this.resolveNextRecommendedAction(
      partner,
      counts,
      latestProductionApprovalRequest,
    );

    const actorIsDashboardUser =
      authenticatedPartner.actorType === 'PARTNER_USER' &&
      authenticatedPartner.partnerUserId !== null;
    const actorCanManageApproval =
      actorIsDashboardUser &&
      authenticatedUser !== null &&
      (authenticatedUser.role === PartnerUserRole.OWNER ||
        authenticatedUser.role === PartnerUserRole.ADMIN);
    const canRequest =
      actorCanManageApproval &&
      !partner.productionEnabled &&
      latestProductionApprovalRequest?.status !==
        ProductionApprovalRequestStatus.PENDING &&
      (nextAction === 'request_production_approval' || nextAction === null) &&
      (!partner.dataPartnerEnabled && !partner.fullAttestationPartnerEnabled
        ? true
        : partner.feedHealthStatus === PartnerFeedHealthStatus.HEALTHY);

    const canCancel =
      actorCanManageApproval &&
      latestProductionApprovalRequest?.status ===
        ProductionApprovalRequestStatus.PENDING;
    const blockedReason = this.resolveProductionApprovalBlockedReason(
      partner,
      nextAction,
      latestProductionApprovalRequest,
      actorIsDashboardUser,
      actorCanManageApproval,
    );

    return {
      canRequest,
      canCancel,
      blockedReason,
      blockedReasonDescription:
        this.describeProductionApprovalBlockedReason(blockedReason),
      latestRequest: latestProductionApprovalRequest,
    };
  }

  private resolveProductionApprovalBlockedReason(
    partner: Partner,
    nextAction: string | null,
    latestProductionApprovalRequest: PartnerProductionApprovalRequestRecord | null,
    actorIsDashboardUser: boolean,
    actorCanManageApproval: boolean,
  ): string | null {
    if (!actorIsDashboardUser) {
      return 'dashboard_user_required';
    }

    if (!actorCanManageApproval) {
      return 'insufficient_role';
    }

    if (partner.productionEnabled) {
      return 'already_production_enabled';
    }

    if (
      latestProductionApprovalRequest?.status ===
      ProductionApprovalRequestStatus.PENDING
    ) {
      return 'pending_review';
    }

    if (
      (partner.dataPartnerEnabled || partner.fullAttestationPartnerEnabled) &&
      partner.feedHealthStatus !== PartnerFeedHealthStatus.HEALTHY
    ) {
      return 'feed_health_not_ready';
    }

    if (
      nextAction !== null &&
      nextAction !== 'request_production_approval' &&
      nextAction !== 'await_production_review'
    ) {
      return 'onboarding_incomplete';
    }

    return null;
  }

  private describeOnboardingAction(action: string | null) {
    if (!action) {
      return 'Review workspace readiness';
    }

    return (
      onboardingActionCatalog[action as keyof typeof onboardingActionCatalog]
        ?.label ?? 'Review workspace readiness'
    );
  }

  private describeProductionApprovalBlockedReason(
    blockedReason: string | null,
  ) {
    if (!blockedReason) {
      return 'Review readiness requirements before requesting production approval.';
    }

    return (
      productionApprovalBlockedReasonDescriptions[blockedReason] ??
      'Review readiness requirements before requesting production approval.'
    );
  }

  private assertValidPublicKey(publicKeyPem: string): void {
    try {
      createPublicKey(publicKeyPem);
    } catch {
      throw new BadRequestException('Invalid public key PEM supplied.');
    }
  }

  private async maybeRecordCredentialUse(credentialId: string): Promise<void> {
    const now = Date.now();
    const minimumIntervalMs = this.configService.get(
      'PARTNER_API_CREDENTIAL_LAST_USED_MIN_INTERVAL_MS',
      {
        infer: true,
      },
    );
    const previousWriteAt = this.lastCredentialUseWriteAt.get(credentialId);

    if (
      previousWriteAt !== undefined &&
      now - previousWriteAt < minimumIntervalMs
    ) {
      return;
    }

    await this.prismaService.partnerApiCredential.update({
      where: { id: credentialId },
      data: {
        lastUsedAt: new Date(now),
      },
    });
    this.lastCredentialUseWriteAt.set(credentialId, now);
  }

  private async maybeRecordDashboardSessionUse(
    sessionId: string,
  ): Promise<void> {
    const now = Date.now();
    const minimumIntervalMs = this.configService.get(
      'PARTNER_DASHBOARD_SESSION_LAST_USED_MIN_INTERVAL_MS',
      {
        infer: true,
      },
    );
    const previousWriteAt = this.lastDashboardSessionUseWriteAt.get(sessionId);

    if (
      previousWriteAt !== undefined &&
      now - previousWriteAt < minimumIntervalMs
    ) {
      return;
    }

    await this.prismaService.dashboardSession.update({
      where: {
        id: sessionId,
      },
      data: {
        lastUsedAt: new Date(now),
      },
    });
    this.lastDashboardSessionUseWriteAt.set(sessionId, now);
  }

  private normalizeUserEmail(email: string): string {
    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedEmail.length === 0) {
      throw new BadRequestException('Email is required.');
    }

    return normalizedEmail;
  }

  private normalizeUserFullName(fullName: string): string {
    const normalizedFullName = fullName.trim();

    if (normalizedFullName.length === 0) {
      throw new BadRequestException('Full name is required.');
    }

    return normalizedFullName;
  }

  private normalizeOptionalNote(note: string | undefined): string | null {
    if (note === undefined) {
      return null;
    }

    const normalizedNote = note.trim();

    return normalizedNote.length > 0 ? normalizedNote : null;
  }

  private assertValidDashboardPassword(password: string): void {
    if (password.length < 12) {
      throw new BadRequestException(
        'Password must be at least 12 characters long.',
      );
    }
  }

  private getPartnerUserScopes(role: PartnerUserRoleValue): string[] {
    switch (role) {
      case partnerUserRoleValues.DEVELOPER:
        return developerDashboardScopes;
      case partnerUserRoleValues.ANALYST:
        return analystDashboardScopes;
      case partnerUserRoleValues.READ_ONLY:
        return readOnlyDashboardScopes;
      case partnerUserRoleValues.ADMIN:
        return adminDashboardScopes;
      case partnerUserRoleValues.OWNER:
      default:
        return ownerDashboardScopes;
    }
  }

  private normalizeIpAllowlist(ipAllowlist: string[]): string[] {
    return [
      ...new Set(ipAllowlist.map((entry) => entry.trim()).filter(Boolean)),
    ].sort();
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
