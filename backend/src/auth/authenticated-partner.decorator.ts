import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import type { AuthenticatedPartner } from './authenticated-partner.interface';
import type { AuthenticatedRequest } from './authenticated-partner.interface';

export const AuthenticatedPartnerContext = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedPartner => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.authenticatedPartner) {
      throw new InternalServerErrorException(
        'Authenticated partner context was not attached to request.',
      );
    }

    return request.authenticatedPartner;
  },
);
