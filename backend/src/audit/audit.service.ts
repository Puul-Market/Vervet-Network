import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditActorType,
  AuditExportFormat,
  AuditExportStatus,
  Prisma,
} from '@prisma/client';
import {
  openSealedString,
  sealString,
} from '../common/security/sealed-data.util';
import type { EnvironmentVariables } from '../config/environment';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAuditExportDto } from './dto/create-audit-export.dto';

interface RecordAuditEventInput {
  actorType: AuditActorType;
  actorPartnerId?: string | null;
  subjectPartnerId?: string | null;
  actorIdentifier?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  summary?: string | null;
  metadata?: Prisma.InputJsonValue;
}

type AuditWriter = Prisma.TransactionClient | PrismaService;

interface ListPartnerAuditLogsParams {
  action?: string;
  actorType?: AuditActorType;
  entityId?: string;
  entityType?: string;
  limit: number;
}

@Injectable()
export class AuditService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  async recordEvent(
    input: RecordAuditEventInput,
    writer?: AuditWriter,
  ): Promise<void> {
    const prismaWriter = writer ?? this.prismaService;

    await prismaWriter.auditLog.create({
      data: {
        actorType: input.actorType,
        actorPartnerId: input.actorPartnerId ?? null,
        subjectPartnerId: input.subjectPartnerId ?? null,
        actorIdentifier: input.actorIdentifier ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        summary: input.summary ?? null,
        metadata: input.metadata,
      },
    });
  }

  async listPartnerAuditLogs(
    partnerId: string,
    params: ListPartnerAuditLogsParams,
  ) {
    return this.prismaService.auditLog.findMany({
      where: {
        subjectPartnerId: partnerId,
        action: params.action,
        actorType: params.actorType,
        entityId: params.entityId,
        entityType: params.entityType,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: params.limit,
      select: {
        id: true,
        actorType: true,
        actorIdentifier: true,
        action: true,
        entityType: true,
        entityId: true,
        summary: true,
        metadata: true,
        createdAt: true,
      },
    });
  }

  async getPartnerAuditLog(partnerId: string, eventId: string) {
    return this.prismaService.auditLog.findFirst({
      where: {
        id: eventId,
        subjectPartnerId: partnerId,
      },
      select: {
        id: true,
        actorType: true,
        actorIdentifier: true,
        action: true,
        entityType: true,
        entityId: true,
        summary: true,
        metadata: true,
        createdAt: true,
      },
    });
  }

  async listPartnerAuditExports(partnerId: string) {
    const auditExports = await this.prismaService.auditExportJob.findMany({
      where: {
        partnerId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        format: true,
        status: true,
        downloadFilename: true,
        downloadMimeType: true,
        downloadContent: true,
        expiresAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return auditExports.map((auditExport) => ({
      ...auditExport,
      downloadContent: this.readAuditExportContent(auditExport.downloadContent),
    }));
  }

  async createAuditExport(
    partnerId: string,
    requestedByUserId: string | null,
    createAuditExportDto: CreateAuditExportDto,
  ) {
    const auditLogs = await this.prismaService.auditLog.findMany({
      where: {
        subjectPartnerId: partnerId,
        actorType: createAuditExportDto.actorType,
        action: createAuditExportDto.action?.trim(),
        entityType: createAuditExportDto.entityType?.trim(),
        ...(createAuditExportDto.dateFrom || createAuditExportDto.dateTo
          ? {
              createdAt: {
                ...(createAuditExportDto.dateFrom
                  ? {
                      gte: new Date(createAuditExportDto.dateFrom),
                    }
                  : {}),
                ...(createAuditExportDto.dateTo
                  ? {
                      lte: new Date(createAuditExportDto.dateTo),
                    }
                  : {}),
              },
            }
          : {}),
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        actorType: true,
        actorIdentifier: true,
        action: true,
        entityType: true,
        entityId: true,
        summary: true,
        metadata: true,
        createdAt: true,
      },
    });

    const serializedContent =
      createAuditExportDto.format === AuditExportFormat.JSON
        ? JSON.stringify(auditLogs, null, 2)
        : this.serializeAuditLogsCsv(auditLogs);
    const fileExtension =
      createAuditExportDto.format === AuditExportFormat.JSON ? 'json' : 'csv';
    const mimeType =
      createAuditExportDto.format === AuditExportFormat.JSON
        ? 'application/json'
        : 'text/csv';
    const now = new Date();
    const encryptAuditExports = await this.shouldEncryptAuditExports(partnerId);
    const storedContent = encryptAuditExports
      ? sealString(
          serializedContent,
          this.configService.get('DATA_ENCRYPTION_MASTER_SECRET', {
            infer: true,
          }),
        )
      : serializedContent;

    const auditExport = await this.prismaService.auditExportJob.create({
      data: {
        partnerId,
        requestedByUserId,
        format: createAuditExportDto.format,
        status: AuditExportStatus.READY,
        filters: {
          actorType: createAuditExportDto.actorType ?? null,
          action: createAuditExportDto.action?.trim() ?? null,
          entityType: createAuditExportDto.entityType?.trim() ?? null,
          dateFrom: createAuditExportDto.dateFrom ?? null,
          dateTo: createAuditExportDto.dateTo ?? null,
        },
        downloadFilename: `audit-export-${now.toISOString().slice(0, 10)}.${fileExtension}`,
        downloadMimeType: mimeType,
        downloadContent: storedContent,
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        completedAt: now,
      },
      select: {
        id: true,
        format: true,
        status: true,
        downloadFilename: true,
        downloadMimeType: true,
        downloadContent: true,
        expiresAt: true,
        completedAt: true,
        createdAt: true,
      },
    });

    return {
      ...auditExport,
      downloadContent: this.readAuditExportContent(auditExport.downloadContent),
    };
  }

  async getAuditExportDownload(partnerId: string, exportId: string) {
    const auditExport = await this.prismaService.auditExportJob.findFirst({
      where: {
        id: exportId,
        partnerId,
      },
      select: {
        id: true,
        status: true,
        downloadFilename: true,
        downloadMimeType: true,
        downloadContent: true,
        expiresAt: true,
      },
    });

    if (!auditExport) {
      throw new NotFoundException(
        'Audit export was not found for the partner.',
      );
    }

    if (
      auditExport.expiresAt &&
      auditExport.expiresAt.getTime() <= Date.now()
    ) {
      await this.prismaService.auditExportJob.update({
        where: {
          id: auditExport.id,
        },
        data: {
          status: AuditExportStatus.EXPIRED,
          downloadContent: null,
        },
      });

      return {
        ...auditExport,
        status: AuditExportStatus.EXPIRED,
        downloadContent: null,
      };
    }

    return {
      ...auditExport,
      downloadContent: this.readAuditExportContent(auditExport.downloadContent),
    };
  }

  async cleanupExpiredAuditExports(): Promise<number> {
    const expiredExports = await this.prismaService.auditExportJob.updateMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
        status: {
          not: AuditExportStatus.EXPIRED,
        },
      },
      data: {
        status: AuditExportStatus.EXPIRED,
        downloadContent: null,
      },
    });

    return expiredExports.count;
  }

  private serializeAuditLogsCsv(
    logs: Array<{
      id: string;
      actorType: AuditActorType;
      actorIdentifier: string | null;
      action: string;
      entityType: string;
      entityId: string;
      summary: string | null;
      metadata: Prisma.JsonValue;
      createdAt: Date;
    }>,
  ): string {
    const header = [
      'id',
      'actorType',
      'actorIdentifier',
      'action',
      'entityType',
      'entityId',
      'summary',
      'metadata',
      'createdAt',
    ];
    const rows = logs.map((log) =>
      [
        log.id,
        log.actorType,
        log.actorIdentifier ?? '',
        log.action,
        log.entityType,
        log.entityId,
        log.summary ?? '',
        JSON.stringify(log.metadata ?? null),
        log.createdAt.toISOString(),
      ]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(','),
    );

    return [header.join(','), ...rows].join('\n');
  }

  private readAuditExportContent(value: string | null): string | null {
    if (!value) {
      return null;
    }

    return openSealedString(
      value,
      this.configService.get('DATA_ENCRYPTION_MASTER_SECRET', {
        infer: true,
      }),
    );
  }

  private async shouldEncryptAuditExports(partnerId: string): Promise<boolean> {
    const partnerSettings =
      await this.prismaService.partnerSecuritySettings.findUnique({
        where: {
          partnerId,
        },
        select: {
          encryptAuditExports: true,
        },
      });

    if (partnerSettings) {
      return partnerSettings.encryptAuditExports;
    }

    return this.configService.get(
      'PARTNER_SECURITY_DEFAULT_ENCRYPT_AUDIT_EXPORTS',
      {
        infer: true,
      },
    );
  }
}
