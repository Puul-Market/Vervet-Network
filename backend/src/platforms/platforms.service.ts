import { Injectable } from '@nestjs/common';
import {
  DestinationStatus,
  IdentifierStatus,
  PartnerStatus,
  PartnerType,
  Prisma,
  RecipientStatus,
} from '@prisma/client';
import { NormalizationService } from '../common/normalization/normalization.service';
import { PrismaService } from '../prisma/prisma.service';

export interface SupportedPlatformRecord {
  id: string;
  slug: string;
  displayName: string;
  partnerType: PartnerType;
  supportsByAddress: boolean;
  supportsByRecipient: boolean;
}

interface ListSupportedPlatformsParams {
  address?: string;
  asset?: string;
  chain?: string;
  lookupMode?: 'BY_ADDRESS' | 'BY_RECIPIENT';
}

@Injectable()
export class PlatformsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly normalizationService: NormalizationService,
  ) {}

  async listSupportedPlatforms(
    params: ListSupportedPlatformsParams = {},
  ): Promise<SupportedPlatformRecord[]> {
    const now = new Date();
    const assetNetworkFilter = this.buildAssetNetworkFilter(params);
    const addressFilter = this.buildAddressFilter(params);
    const activeDestinationFilter: Prisma.RecipientDestinationWhereInput = {
      status: DestinationStatus.ACTIVE,
      effectiveFrom: {
        lte: now,
      },
      OR: [
        {
          expiresAt: null,
        },
        {
          expiresAt: {
            gt: now,
          },
        },
      ],
      ...(addressFilter
        ? {
            addressNormalized: addressFilter,
          }
        : {}),
      ...(assetNetworkFilter ? { assetNetwork: assetNetworkFilter } : {}),
    };

    const [byAddressPartners, byRecipientPartners] = await Promise.all([
      this.prismaService.partner.findMany({
        where: {
          status: PartnerStatus.ACTIVE,
          isDirectoryListed: true,
          recipients: {
            some: {
              status: RecipientStatus.ACTIVE,
              destinations: {
                some: activeDestinationFilter,
              },
            },
          },
        },
        select: {
          id: true,
        },
      }),
      this.prismaService.partner.findMany({
        where: {
          status: PartnerStatus.ACTIVE,
          isDirectoryListed: true,
          recipients: {
            some: {
              status: RecipientStatus.ACTIVE,
              identifiers: {
                some: {
                  status: IdentifierStatus.ACTIVE,
                },
              },
              destinations: {
                some: activeDestinationFilter,
              },
            },
          },
        },
        select: {
          id: true,
        },
      }),
    ]);

    const byAddressPartnerIds = new Set(
      byAddressPartners.map((partner) => partner.id),
    );
    const byRecipientPartnerIds = new Set(
      byRecipientPartners.map((partner) => partner.id),
    );
    const supportedPartnerIds =
      params.lookupMode === 'BY_ADDRESS'
        ? Array.from(byAddressPartnerIds)
        : params.lookupMode === 'BY_RECIPIENT'
          ? Array.from(byRecipientPartnerIds)
          : [
              ...new Set([
                ...Array.from(byAddressPartnerIds),
                ...Array.from(byRecipientPartnerIds),
              ]),
            ];

    if (supportedPartnerIds.length === 0) {
      return [];
    }

    const partners = await this.prismaService.partner.findMany({
      where: {
        id: {
          in: supportedPartnerIds,
        },
        status: PartnerStatus.ACTIVE,
        isDirectoryListed: true,
      },
      select: {
        id: true,
        slug: true,
        displayName: true,
        partnerType: true,
      },
      orderBy: [{ displayName: 'asc' }, { slug: 'asc' }],
    });

    return partners.map((partner) => ({
      id: partner.id,
      slug: partner.slug,
      displayName: partner.displayName,
      partnerType: partner.partnerType,
      supportsByAddress: byAddressPartnerIds.has(partner.id),
      supportsByRecipient: byRecipientPartnerIds.has(partner.id),
    }));
  }

  private buildAssetNetworkFilter(
    params: ListSupportedPlatformsParams,
  ): Prisma.AssetNetworkWhereInput | undefined {
    const chain = params.chain?.trim();
    const asset = params.asset?.trim();

    if (!chain && !asset) {
      return undefined;
    }

    const filter: Prisma.AssetNetworkWhereInput = {
      isActive: true,
    };

    if (chain) {
      filter.chain = {
        slug: this.normalizationService.normalizeChain(chain),
        isActive: true,
      };
    }

    if (asset) {
      filter.asset = {
        OR: [
          {
            code: this.normalizationService.normalizeAssetCode(asset),
          },
          {
            symbol: this.normalizationService.normalizeAssetSymbol(asset),
          },
        ],
      };
    }

    return filter;
  }

  private buildAddressFilter(
    params: ListSupportedPlatformsParams,
  ): string | undefined {
    const address = params.address?.trim();
    const chain = params.chain?.trim();

    if (!address || !chain) {
      return undefined;
    }

    return this.normalizationService.normalizeAddress(chain, address);
  }
}
