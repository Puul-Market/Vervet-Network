import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/environment';
import { PrismaService } from '../../prisma/prisma.service';
import type { EncryptedFieldDto } from './encrypted-field.dto';
import { openEncryptedField } from './encrypted-field.util';

export type EncryptedSubmissionKeyProvider =
  | {
      kind: 'PLATFORM_MANAGED';
    }
  | {
      kind: 'EXTERNAL_KMS';
      customerKeyArn: string;
      customerKeyStatus: string | null;
    };

export interface PartnerEncryptedSubmissionPolicy {
  enabled: boolean;
  keyProvider: EncryptedSubmissionKeyProvider;
}

@Injectable()
export class EncryptedSubmissionService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  async getPartnerPolicy(
    partnerId: string,
  ): Promise<PartnerEncryptedSubmissionPolicy> {
    const settings =
      await this.prismaService.partnerSecuritySettings.findUnique({
        where: {
          partnerId,
        },
        select: {
          enableEncryptedSubmission: true,
          enterpriseByokEnabled: true,
          customerKeyArn: true,
          customerKeyStatus: true,
        },
      });

    return {
      enabled: settings?.enableEncryptedSubmission ?? false,
      keyProvider: this.resolveKeyProvider({
        enterpriseByokEnabled: settings?.enterpriseByokEnabled ?? false,
        customerKeyArn: settings?.customerKeyArn ?? null,
        customerKeyStatus: settings?.customerKeyStatus ?? null,
      }),
    };
  }

  openField(
    encryptedValue: EncryptedFieldDto,
    policy: PartnerEncryptedSubmissionPolicy,
    fieldLabel: string,
  ): string {
    if (!policy.enabled) {
      throw new ForbiddenException(
        'Encrypted submission is not enabled for this partner.',
      );
    }

    try {
      return openEncryptedField(
        encryptedValue,
        this.resolveDecryptionSecret(policy.keyProvider),
      );
    } catch (error: unknown) {
      throw new BadRequestException(
        `${fieldLabel} encrypted payload could not be decrypted.`,
        {
          cause: error,
        },
      );
    }
  }

  private resolveKeyProvider(params: {
    enterpriseByokEnabled: boolean;
    customerKeyArn: string | null;
    customerKeyStatus: string | null;
  }): EncryptedSubmissionKeyProvider {
    const customerKeyArn = params.customerKeyArn?.trim() ?? null;
    const customerKeyStatus = params.customerKeyStatus?.trim() ?? null;

    if (params.enterpriseByokEnabled && customerKeyArn) {
      return {
        kind: 'EXTERNAL_KMS',
        customerKeyArn,
        customerKeyStatus,
      };
    }

    return {
      kind: 'PLATFORM_MANAGED',
    };
  }

  private resolveDecryptionSecret(
    keyProvider: EncryptedSubmissionKeyProvider,
  ): string {
    switch (keyProvider.kind) {
      case 'EXTERNAL_KMS':
        return this.resolveExternalKmsSecret(keyProvider);
      case 'PLATFORM_MANAGED':
      default:
        return this.getPlatformManagedSecret();
    }
  }

  private resolveExternalKmsSecret(
    keyProvider: Extract<
      EncryptedSubmissionKeyProvider,
      {
        kind: 'EXTERNAL_KMS';
      }
    >,
  ): string {
    void keyProvider;

    // External KMS decryption plugs in here next; BYOK-configured partners
    // still bridge through the platform-managed secret until that lands.
    return this.getPlatformManagedSecret();
  }

  private getPlatformManagedSecret(): string {
    return this.configService.get('ENCRYPTED_SUBMISSION_MASTER_SECRET', {
      infer: true,
    });
  }
}
