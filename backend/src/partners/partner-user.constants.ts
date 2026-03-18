export const partnerUserRoleValues = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  DEVELOPER: 'DEVELOPER',
  ANALYST: 'ANALYST',
  READ_ONLY: 'READ_ONLY',
} as const;

export type PartnerUserRoleValue =
  (typeof partnerUserRoleValues)[keyof typeof partnerUserRoleValues];

export const partnerUserStatusValues = {
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
} as const;

export type PartnerUserStatusValue =
  (typeof partnerUserStatusValues)[keyof typeof partnerUserStatusValues];
