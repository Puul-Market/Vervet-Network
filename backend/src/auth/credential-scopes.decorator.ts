import { SetMetadata } from '@nestjs/common';

export const credentialScopesMetadataKey = 'credentialScopes';

export const RequireCredentialScopes = (...scopes: string[]) =>
  SetMetadata(credentialScopesMetadataKey, scopes);
