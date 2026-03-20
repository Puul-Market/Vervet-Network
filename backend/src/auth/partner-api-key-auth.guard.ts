import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { PartnerOnboardingStage } from '@prisma/client';
import { Reflector } from '@nestjs/core';
import { PartnersService } from '../partners/partners.service';
import type {
  AuthenticatedPartner,
  AuthenticatedRequest,
} from './authenticated-partner.interface';
import { credentialScopesMetadataKey } from './credential-scopes.decorator';
import {
  partnerAccessPolicyDecorator,
  type PartnerAccessPolicyDefinition,
} from './partner-access-policy.decorator';

const partnerOnboardingStageOrder: PartnerOnboardingStage[] = [
  'ACCOUNT_CREATED',
  'API_ACCESS_READY',
  'TRUST_SETUP_READY',
  'DATA_MAPPING_IN_PROGRESS',
  'BOOTSTRAP_IMPORT_COMPLETED',
  'LIVE_FEED_CONNECTED',
  'PRODUCTION_APPROVED',
];

@Injectable()
export class PartnerApiKeyAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly partnersService: PartnersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorizationHeader = request.headers.authorization;

    if (!authorizationHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const accessToken = authorizationHeader.slice('Bearer '.length).trim();

    if (!accessToken) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const requiredScopes =
      this.reflector.getAllAndOverride<string[]>(credentialScopesMetadataKey, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    request.authenticatedPartner =
      await this.partnersService.authenticatePartnerAccessToken(
        accessToken,
        requiredScopes,
      );
    this.assertPartnerAccessPolicy(request.authenticatedPartner, context);

    return true;
  }

  private assertPartnerAccessPolicy(
    authenticatedPartner: AuthenticatedPartner,
    context: ExecutionContext,
  ): void {
    const normalizedPolicies = [
      this.reflector.get<PartnerAccessPolicyDefinition>(
        partnerAccessPolicyDecorator,
        context.getClass(),
      ),
      this.reflector.get<PartnerAccessPolicyDefinition>(
        partnerAccessPolicyDecorator,
        context.getHandler(),
      ),
    ].filter(
      (policy): policy is PartnerAccessPolicyDefinition => policy !== undefined,
    );

    for (const policy of normalizedPolicies) {
      if (
        policy.actorTypes &&
        !policy.actorTypes.includes(authenticatedPartner.actorType)
      ) {
        throw new ForbiddenException(
          policy.actorTypes.length === 1 &&
            policy.actorTypes[0] === 'PARTNER_USER'
            ? 'This endpoint requires a dashboard user session.'
            : 'This endpoint is not available for the current actor type.',
        );
      }

      if (
        policy.anyCapabilities &&
        !policy.anyCapabilities.some(
          (capability: keyof typeof authenticatedPartner.partnerCapabilities) =>
            authenticatedPartner.partnerCapabilities[capability],
        )
      ) {
        throw new ForbiddenException(
          'This endpoint is not enabled for the partner capability profile.',
        );
      }

      if (
        policy.allCapabilities &&
        !policy.allCapabilities.every(
          (capability: keyof typeof authenticatedPartner.partnerCapabilities) =>
            authenticatedPartner.partnerCapabilities[capability],
        )
      ) {
        throw new ForbiddenException(
          'This endpoint is not enabled for the partner capability profile.',
        );
      }

      if (
        policy.anyPlanEntitlements &&
        !policy.anyPlanEntitlements.some(
          (
            entitlement: keyof typeof authenticatedPartner.partnerPlanEntitlements,
          ) => authenticatedPartner.partnerPlanEntitlements[entitlement],
        )
      ) {
        throw new ForbiddenException(
          'This endpoint is not enabled for the partner pricing plan.',
        );
      }

      if (
        policy.allPlanEntitlements &&
        !policy.allPlanEntitlements.every(
          (
            entitlement: keyof typeof authenticatedPartner.partnerPlanEntitlements,
          ) => authenticatedPartner.partnerPlanEntitlements[entitlement],
        )
      ) {
        throw new ForbiddenException(
          'This endpoint is not enabled for the partner pricing plan.',
        );
      }

      if (
        policy.minOnboardingStage &&
        this.getOnboardingStageRank(
          authenticatedPartner.partnerOnboardingStage,
        ) < this.getOnboardingStageRank(policy.minOnboardingStage)
      ) {
        throw new ForbiddenException(
          'Complete the required onboarding steps before accessing this endpoint.',
        );
      }

      if (
        policy.partnerUserRoles &&
        authenticatedPartner.actorType === 'PARTNER_USER' &&
        (!authenticatedPartner.partnerUserRole ||
          !policy.partnerUserRoles.includes(
            authenticatedPartner.partnerUserRole,
          ))
      ) {
        throw new ForbiddenException(
          `This endpoint requires one of the following partner roles: ${policy.partnerUserRoles.join(
            ', ',
          )}.`,
        );
      }

      if (
        policy.requireOperationalEnvironment &&
        !authenticatedPartner.partnerCapabilities.sandboxEnabled &&
        !authenticatedPartner.partnerCapabilities.productionEnabled
      ) {
        throw new ForbiddenException(
          'This endpoint requires sandbox or production access for the partner.',
        );
      }
    }
  }

  private getOnboardingStageRank(stage: PartnerOnboardingStage): number {
    const rank = partnerOnboardingStageOrder.indexOf(stage);

    return rank === -1 ? -1 : rank;
  }
}
