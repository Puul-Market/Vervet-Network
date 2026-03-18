import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { EnvironmentVariables } from '../config/environment';

@Injectable()
export class AdminTokenAuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<
        Request & { headers: Record<string, string | string[] | undefined> }
      >();
    const configuredToken = this.configService.get('ADMIN_API_TOKEN', {
      infer: true,
    });
    const providedToken = request.headers['x-admin-token'];

    if (typeof providedToken !== 'string' || !providedToken.trim()) {
      throw new UnauthorizedException('Missing admin token.');
    }

    const providedTokenBuffer = Buffer.from(providedToken.trim());
    const configuredTokenBuffer = Buffer.from(configuredToken);

    if (
      providedTokenBuffer.length !== configuredTokenBuffer.length ||
      !timingSafeEqual(providedTokenBuffer, configuredTokenBuffer)
    ) {
      throw new UnauthorizedException('Invalid admin token.');
    }

    return true;
  }
}
