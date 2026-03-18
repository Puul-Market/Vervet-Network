import 'dotenv/config';
import { createHash } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  AttestationType,
  AuditActorType,
  ChainFamily,
  DeliveryStatus,
  DestinationStatus,
  IdentifierKind,
  IdentifierStatus,
  IdentifierVisibility,
  MemoPolicy,
  PartnerFeedHealthStatus,
  PartnerOnboardingStage,
  PartnerStatus,
  PartnerType,
  ProductionApprovalRequestStatus,
  PartnerUserRole,
  PartnerUserStatus,
  PrismaClient,
  QueryType,
  ResolutionOutcome,
  RiskLevel,
  RiskSignalKind,
  SigningKeyAlgorithm,
  SigningKeyStatus,
  TokenStandard,
  VerificationStatus,
  WebhookEventType,
  WebhookStatus,
} from '@prisma/client';
import { hashSecret } from '../src/common/security/secret-hash.util';
import {
  generateApiCredential,
  normalizeCredentialScopes,
} from '../src/partners/api-credential.util';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set before running the seed script.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: databaseUrl,
  }),
  errorFormat: 'pretty',
});

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

const analystDashboardScopes = normalizeCredentialScopes([
  'partners:read',
  'attestations:read',
  'recipients:read',
  'destinations:read',
  'resolution:read',
  'webhooks:read',
  'audit:read',
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

const evmSeedChains = new Set(['ethereum', 'base', 'bnb-smart-chain']);

interface RecipientSeed {
  externalRecipientId: string;
  displayName: string;
  identifier: string;
  destinationAddress: string;
  chainSlug: 'ethereum' | 'tron' | 'base' | 'bnb-smart-chain';
  assetCode: 'usdc';
}

interface PartnerSeed {
  slug: string;
  displayName: string;
  partnerType: PartnerType;
  countryCode: string;
  isDirectoryListed?: boolean;
  apiConsumerEnabled: boolean;
  dataPartnerEnabled: boolean;
  fullAttestationPartnerEnabled: boolean;
  webhooksEnabled: boolean;
  batchVerificationEnabled: boolean;
  auditExportsEnabled: boolean;
  sandboxEnabled: boolean;
  productionEnabled: boolean;
  onboardingStage: PartnerOnboardingStage;
  feedHealthStatus: PartnerFeedHealthStatus;
  metadata?: Record<string, string>;
  recipients: RecipientSeed[];
}

const curatedPlatformSeeds: PartnerSeed[] = [
  {
    slug: 'binance',
    displayName: 'Binance',
    partnerType: PartnerType.EXCHANGE,
    countryCode: 'SC',
    apiConsumerEnabled: true,
    dataPartnerEnabled: true,
    fullAttestationPartnerEnabled: false,
    webhooksEnabled: true,
    batchVerificationEnabled: true,
    auditExportsEnabled: true,
    sandboxEnabled: true,
    productionEnabled: false,
    onboardingStage: PartnerOnboardingStage.LIVE_FEED_CONNECTED,
    feedHealthStatus: PartnerFeedHealthStatus.HEALTHY,
    recipients: [
      {
        externalRecipientId: 'binance-finance-01',
        displayName: 'Binance Treasury',
        identifier: 'treasury@binance',
        destinationAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        chainSlug: 'ethereum',
        assetCode: 'usdc',
      },
    ],
  },
  {
    slug: 'bybit',
    displayName: 'Bybit',
    partnerType: PartnerType.EXCHANGE,
    countryCode: 'AE',
    apiConsumerEnabled: true,
    dataPartnerEnabled: true,
    fullAttestationPartnerEnabled: true,
    webhooksEnabled: true,
    batchVerificationEnabled: true,
    auditExportsEnabled: true,
    sandboxEnabled: true,
    productionEnabled: true,
    onboardingStage: PartnerOnboardingStage.PRODUCTION_APPROVED,
    feedHealthStatus: PartnerFeedHealthStatus.HEALTHY,
    recipients: [
      {
        externalRecipientId: 'bybit-jane-01',
        displayName: 'Jane A.',
        identifier: 'jane@bybit',
        destinationAddress: '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
        chainSlug: 'ethereum',
        assetCode: 'usdc',
      },
      {
        externalRecipientId: 'bybit-jane-01',
        displayName: 'Jane A.',
        identifier: 'jane@bybit',
        destinationAddress: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
        chainSlug: 'base',
        assetCode: 'usdc',
      },
    ],
  },
  {
    slug: 'coinbase',
    displayName: 'Coinbase',
    partnerType: PartnerType.EXCHANGE,
    countryCode: 'US',
    apiConsumerEnabled: true,
    dataPartnerEnabled: true,
    fullAttestationPartnerEnabled: false,
    webhooksEnabled: true,
    batchVerificationEnabled: true,
    auditExportsEnabled: true,
    sandboxEnabled: true,
    productionEnabled: false,
    onboardingStage: PartnerOnboardingStage.BOOTSTRAP_IMPORT_COMPLETED,
    feedHealthStatus: PartnerFeedHealthStatus.HEALTHY,
    recipients: [
      {
        externalRecipientId: 'coinbase-ops-01',
        displayName: 'Coinbase Ops',
        identifier: 'ops@coinbase',
        destinationAddress: '0x66f820a414680B5bcda5eECA5dea238543F42054',
        chainSlug: 'ethereum',
        assetCode: 'usdc',
      },
    ],
  },
  {
    slug: 'trustwallet',
    displayName: 'Trust Wallet',
    partnerType: PartnerType.WALLET,
    countryCode: 'US',
    apiConsumerEnabled: false,
    dataPartnerEnabled: true,
    fullAttestationPartnerEnabled: false,
    webhooksEnabled: true,
    batchVerificationEnabled: false,
    auditExportsEnabled: true,
    sandboxEnabled: true,
    productionEnabled: false,
    onboardingStage: PartnerOnboardingStage.LIVE_FEED_CONNECTED,
    feedHealthStatus: PartnerFeedHealthStatus.HEALTHY,
    recipients: [
      {
        externalRecipientId: 'trustwallet-wallet-01',
        displayName: 'Primary Wallet',
        identifier: 'wallet@trustwallet',
        destinationAddress: '0xdc76cd25977e0a5ae17155770273ad58648900d3',
        chainSlug: 'ethereum',
        assetCode: 'usdc',
      },
      {
        externalRecipientId: 'trustwallet-wallet-01',
        displayName: 'Primary Wallet',
        identifier: 'wallet@trustwallet',
        destinationAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        chainSlug: 'base',
        assetCode: 'usdc',
      },
      {
        externalRecipientId: 'trustwallet-wallet-01',
        displayName: 'Primary Wallet',
        identifier: 'wallet@trustwallet',
        destinationAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
        chainSlug: 'bnb-smart-chain',
        assetCode: 'usdc',
      },
    ],
  },
  {
    slug: 'ivorypay',
    displayName: 'Ivorypay',
    partnerType: PartnerType.PAYMENT_PROCESSOR,
    countryCode: 'NG',
    apiConsumerEnabled: true,
    dataPartnerEnabled: true,
    fullAttestationPartnerEnabled: true,
    webhooksEnabled: true,
    batchVerificationEnabled: true,
    auditExportsEnabled: true,
    sandboxEnabled: true,
    productionEnabled: true,
    onboardingStage: PartnerOnboardingStage.PRODUCTION_APPROVED,
    feedHealthStatus: PartnerFeedHealthStatus.HEALTHY,
    recipients: [
      {
        externalRecipientId: 'ivorypay-merchant-01',
        displayName: 'Acme Merchant',
        identifier: 'merchant@ivorypay',
        destinationAddress: '0x71c7656EC7ab88b098defB751B7401B5f6d8976F',
        chainSlug: 'ethereum',
        assetCode: 'usdc',
      },
      {
        externalRecipientId: 'ivorypay-treasury-01',
        displayName: 'Treasury Ops',
        identifier: 'treasury@ivorypay',
        destinationAddress: '0x267be1C1D684F78cb4F6a176C4911b741E4Ffdc0',
        chainSlug: 'ethereum',
        assetCode: 'usdc',
      },
      {
        externalRecipientId: 'ivorypay-payroll-01',
        displayName: 'Payroll Clearing',
        identifier: 'payroll@ivorypay',
        destinationAddress: 'TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj',
        chainSlug: 'tron',
        assetCode: 'usdc',
      },
      {
        externalRecipientId: 'ivorypay-merchant-01',
        displayName: 'Acme Merchant',
        identifier: 'merchant@ivorypay',
        destinationAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
        chainSlug: 'bnb-smart-chain',
        assetCode: 'usdc',
      },
    ],
  },
];

const qaPartnerSeeds: PartnerSeed[] = [
  {
    slug: 'atlas-consumer-demo',
    displayName: 'Atlas Consumer Demo',
    partnerType: PartnerType.FINTECH,
    countryCode: 'GB',
    isDirectoryListed: false,
    apiConsumerEnabled: true,
    dataPartnerEnabled: false,
    fullAttestationPartnerEnabled: false,
    webhooksEnabled: true,
    batchVerificationEnabled: true,
    auditExportsEnabled: true,
    sandboxEnabled: true,
    productionEnabled: false,
    onboardingStage: PartnerOnboardingStage.API_ACCESS_READY,
    feedHealthStatus: PartnerFeedHealthStatus.UNKNOWN,
    recipients: [],
  },
  {
    slug: 'signal-degraded-demo',
    displayName: 'Signal Degraded Demo',
    partnerType: PartnerType.PAYMENT_PROCESSOR,
    countryCode: 'NG',
    isDirectoryListed: false,
    apiConsumerEnabled: true,
    dataPartnerEnabled: true,
    fullAttestationPartnerEnabled: false,
    webhooksEnabled: true,
    batchVerificationEnabled: true,
    auditExportsEnabled: true,
    sandboxEnabled: true,
    productionEnabled: false,
    onboardingStage: PartnerOnboardingStage.LIVE_FEED_CONNECTED,
    feedHealthStatus: PartnerFeedHealthStatus.DEGRADED,
    recipients: [
      {
        externalRecipientId: 'signal-merchant-01',
        displayName: 'Signal Merchant',
        identifier: 'merchant@signal-demo',
        destinationAddress: '0x52908400098527886E0F7030069857D2E4169EE7',
        chainSlug: 'ethereum',
        assetCode: 'usdc',
      },
    ],
  },
  {
    slug: 'locked-restricted-demo',
    displayName: 'Locked Restricted Demo',
    partnerType: PartnerType.FINTECH,
    countryCode: 'US',
    isDirectoryListed: false,
    apiConsumerEnabled: true,
    dataPartnerEnabled: false,
    fullAttestationPartnerEnabled: false,
    webhooksEnabled: true,
    batchVerificationEnabled: true,
    auditExportsEnabled: true,
    sandboxEnabled: false,
    productionEnabled: false,
    onboardingStage: PartnerOnboardingStage.ACCOUNT_CREATED,
    feedHealthStatus: PartnerFeedHealthStatus.UNKNOWN,
    recipients: [],
  },
  {
    slug: 'harbor-data-onboarding-demo',
    displayName: 'Harbor Data Onboarding Demo',
    partnerType: PartnerType.PAYMENT_PROCESSOR,
    countryCode: 'NG',
    isDirectoryListed: false,
    apiConsumerEnabled: false,
    dataPartnerEnabled: true,
    fullAttestationPartnerEnabled: false,
    webhooksEnabled: true,
    batchVerificationEnabled: false,
    auditExportsEnabled: true,
    sandboxEnabled: true,
    productionEnabled: false,
    onboardingStage: PartnerOnboardingStage.ACCOUNT_CREATED,
    feedHealthStatus: PartnerFeedHealthStatus.UNKNOWN,
    recipients: [],
  },
];

const seededPartnerSeeds = [...curatedPlatformSeeds, ...qaPartnerSeeds];

async function main() {
  await resetDirectoryListing();
  const chains = await ensureChains();
  const assets = await ensureAssets();
  const assetNetworks = await ensureAssetNetworks(chains, assets);

  const seededPartners = [];

  for (const [index, partnerSeed] of seededPartnerSeeds.entries()) {
    const partner = await ensureDirectoryPartner(partnerSeed);
    const signingKey = await ensureSigningKey(partner.id, partner.slug, partner.displayName);
    const recipients = await ensureRecipientsForPartner(
      partner.id,
      signingKey.id,
      partnerSeed.recipients,
      assetNetworks,
      index * 100,
    );

    if (partnerSeed.productionEnabled) {
      await ensurePartnerProductionCorridors(partner.id, recipients);
    }

    seededPartners.push({
      partner,
      signingKey,
      recipients,
    });
  }

  const ivorypayPartner = seededPartners.find(
    (entry) => entry.partner.slug === 'ivorypay',
  );
  const trustWalletPartner = seededPartners.find(
    (entry) => entry.partner.slug === 'trustwallet',
  );
  const consumerDemoPartner = seededPartners.find(
    (entry) => entry.partner.slug === 'atlas-consumer-demo',
  );
  const degradedDemoPartner = seededPartners.find(
    (entry) => entry.partner.slug === 'signal-degraded-demo',
  );
  const restrictedDemoPartner = seededPartners.find(
    (entry) => entry.partner.slug === 'locked-restricted-demo',
  );
  const firstTimeDataPartner = seededPartners.find(
    (entry) => entry.partner.slug === 'harbor-data-onboarding-demo',
  );

  if (!ivorypayPartner) {
    throw new Error('Ivorypay seed partner was not created.');
  }
  if (!trustWalletPartner) {
    throw new Error('Trust Wallet seed partner was not created.');
  }
  if (!consumerDemoPartner) {
    throw new Error('Consumer demo partner was not created.');
  }
  if (!degradedDemoPartner) {
    throw new Error('Degraded demo partner was not created.');
  }
  if (!restrictedDemoPartner) {
    throw new Error('Restricted demo partner was not created.');
  }
  if (!firstTimeDataPartner) {
    throw new Error('First-time data-partner demo was not created.');
  }

  const demoUsers = await Promise.all([
    ensurePartnerUser({
      partnerId: ivorypayPartner.partner.id,
      email: 'ops@ivorypay.demo',
      fullName: 'Ivorypay Ops',
      role: PartnerUserRole.OWNER,
      scopes: ownerDashboardScopes,
      password: 'Vervet-Ivorypay-2026!',
    }),
    ensurePartnerUser({
      partnerId: ivorypayPartner.partner.id,
      email: 'analyst@ivorypay.demo',
      fullName: 'Ivorypay Analyst',
      role: PartnerUserRole.ANALYST,
      scopes: analystDashboardScopes,
      password: 'Vervet-Ivorypay-Analyst-2026!',
    }),
    ensurePartnerUser({
      partnerId: ivorypayPartner.partner.id,
      email: 'developer@ivorypay.demo',
      fullName: 'Ivorypay Developer',
      role: PartnerUserRole.DEVELOPER,
      scopes: developerDashboardScopes,
      password: 'Vervet-Ivorypay-Developer-2026!',
    }),
    ensurePartnerUser({
      partnerId: trustWalletPartner.partner.id,
      email: 'ops@trustwallet.demo',
      fullName: 'Trust Wallet Ops',
      role: PartnerUserRole.OWNER,
      scopes: ownerDashboardScopes,
      password: 'Vervet-TrustWallet-2026!',
    }),
    ensurePartnerUser({
      partnerId: consumerDemoPartner.partner.id,
      email: 'ops@consumer.demo',
      fullName: 'Atlas Consumer Ops',
      role: PartnerUserRole.OWNER,
      scopes: ownerDashboardScopes,
      password: 'Vervet-Consumer-2026!',
    }),
    ensurePartnerUser({
      partnerId: degradedDemoPartner.partner.id,
      email: 'ops@degraded.demo',
      fullName: 'Signal Degraded Ops',
      role: PartnerUserRole.OWNER,
      scopes: ownerDashboardScopes,
      password: 'Vervet-Degraded-2026!',
    }),
    ensurePartnerUser({
      partnerId: restrictedDemoPartner.partner.id,
      email: 'ops@restricted.demo',
      fullName: 'Locked Restricted Ops',
      role: PartnerUserRole.OWNER,
      scopes: ownerDashboardScopes,
      password: 'Vervet-Restricted-2026!',
    }),
    ensurePartnerUser({
      partnerId: firstTimeDataPartner.partner.id,
      email: 'ops@harbordata.demo',
      fullName: 'Harbor Data Ops',
      role: PartnerUserRole.OWNER,
      scopes: ownerDashboardScopes,
      password: 'Vervet-HarborData-2026!',
      lastLoginAt: null,
    }),
  ]);

  const ownerUser = demoUsers.find((user) => user.email === 'ops@ivorypay.demo');
  const analystUser = demoUsers.find(
    (user) => user.email === 'analyst@ivorypay.demo',
  );
  const consumerOwnerUser = demoUsers.find(
    (user) => user.email === 'ops@consumer.demo',
  );

  if (!ownerUser || !analystUser || !consumerOwnerUser) {
    throw new Error('Primary seeded dashboard users were not created.');
  }

  const securityPartnerIds = new Set(
    demoUsers.map((user) => user.partnerId),
  );

  for (const partnerId of securityPartnerIds) {
    await ensurePartnerSecuritySettings(partnerId);
  }

  await ensureApiCredential(
    ivorypayPartner.partner.id,
    'Production Resolver',
    normalizeCredentialScopes([
      'resolution:read',
      'resolution:batch',
      'recipients:read',
      'destinations:read',
      'attestations:read',
      'webhooks:read',
    ]),
  );
  const webhookEndpoint = await ensureWebhookEndpoint(ivorypayPartner.partner.id);
  await ensureWebhookDeliveries(webhookEndpoint.id);
  await ensureAuditLogs({
    partnerId: ivorypayPartner.partner.id,
    ownerUserEmail: ownerUser.email,
  });
  await ensureResolutionRequests({
    requesterPartnerId: ivorypayPartner.partner.id,
    requestedByUserId: ownerUser.id,
    bybitRecipient: findRecipientSeedData(seededPartners, 'bybit', 'jane@bybit'),
    ivorypayRecipient: findRecipientSeedData(
      seededPartners,
      'ivorypay',
      'merchant@ivorypay',
    ),
  });
  await ensurePendingProductionApprovalRequest({
    partnerId: consumerDemoPartner.partner.id,
    requestedByUserId: consumerOwnerUser.id,
    assetNetworkIds: [assetNetworks['ethereum:usdc'].id],
    requestNote:
      'Seeded pending approval request for browser-based admin review coverage.',
  });

  console.log('Seeded curated platform directory and demo dashboard data.');
  console.log('Dashboard login: ops@ivorypay.demo / Vervet-Ivorypay-2026!');
  console.log(
    `Additional analyst login: ${analystUser.email} / Vervet-Ivorypay-Analyst-2026!`,
  );
  console.log(
    'Developer login: developer@ivorypay.demo / Vervet-Ivorypay-Developer-2026!',
  );
  console.log('Consumer-only login: ops@consumer.demo / Vervet-Consumer-2026!');
  console.log(
    'Data-partner login: ops@trustwallet.demo / Vervet-TrustWallet-2026!',
  );
  console.log('Degraded demo login: ops@degraded.demo / Vervet-Degraded-2026!');
  console.log(
    'Restricted demo login: ops@restricted.demo / Vervet-Restricted-2026!',
  );
  console.log(
    'First-time data-partner login: ops@harbordata.demo / Vervet-HarborData-2026!',
  );
}

async function resetDirectoryListing() {
  await prisma.partner.updateMany({
    where: {
      slug: {
        notIn: seededPartnerSeeds.map((seed) => seed.slug),
      },
    },
    data: {
      isDirectoryListed: false,
    },
  });
}

async function ensureChains() {
  const ethereum = await prisma.chain.upsert({
    where: { slug: 'ethereum' },
    update: {
      displayName: 'Ethereum',
      family: ChainFamily.EVM,
      isActive: true,
    },
    create: {
      slug: 'ethereum',
      displayName: 'Ethereum',
      family: ChainFamily.EVM,
    },
  });

  const tron = await prisma.chain.upsert({
    where: { slug: 'tron' },
    update: {
      displayName: 'Tron',
      family: ChainFamily.TRON,
      isActive: true,
    },
    create: {
      slug: 'tron',
      displayName: 'Tron',
      family: ChainFamily.TRON,
    },
  });

  const solana = await prisma.chain.upsert({
    where: { slug: 'solana' },
    update: {
      displayName: 'Solana',
      family: ChainFamily.SOLANA,
      isActive: true,
    },
    create: {
      slug: 'solana',
      displayName: 'Solana',
      family: ChainFamily.SOLANA,
    },
  });

  const base = await prisma.chain.upsert({
    where: { slug: 'base' },
    update: {
      displayName: 'Base',
      family: ChainFamily.EVM,
      isActive: true,
    },
    create: {
      slug: 'base',
      displayName: 'Base',
      family: ChainFamily.EVM,
    },
  });

  const bnbSmartChain = await prisma.chain.upsert({
    where: { slug: 'bnb-smart-chain' },
    update: {
      displayName: 'BNB Smart Chain',
      family: ChainFamily.EVM,
      isActive: true,
    },
    create: {
      slug: 'bnb-smart-chain',
      displayName: 'BNB Smart Chain',
      family: ChainFamily.EVM,
    },
  });

  return { ethereum, tron, solana, base, bnbSmartChain };
}

async function ensureAssets() {
  const eth = await prisma.asset.upsert({
    where: { code: 'eth' },
    update: {
      symbol: 'ETH',
      displayName: 'Ether',
      isActive: true,
    },
    create: {
      code: 'eth',
      symbol: 'ETH',
      displayName: 'Ether',
    },
  });

  const trx = await prisma.asset.upsert({
    where: { code: 'trx' },
    update: {
      symbol: 'TRX',
      displayName: 'TRON',
      isActive: true,
    },
    create: {
      code: 'trx',
      symbol: 'TRX',
      displayName: 'TRON',
    },
  });

  const sol = await prisma.asset.upsert({
    where: { code: 'sol' },
    update: {
      symbol: 'SOL',
      displayName: 'Solana',
      isActive: true,
    },
    create: {
      code: 'sol',
      symbol: 'SOL',
      displayName: 'Solana',
    },
  });

  const usdc = await prisma.asset.upsert({
    where: { code: 'usdc' },
    update: {
      symbol: 'USDC',
      displayName: 'USD Coin',
      isActive: true,
    },
    create: {
      code: 'usdc',
      symbol: 'USDC',
      displayName: 'USD Coin',
    },
  });

  return { eth, trx, sol, usdc };
}

async function ensureAssetNetworks(
  chains: Awaited<ReturnType<typeof ensureChains>>,
  assets: Awaited<ReturnType<typeof ensureAssets>>,
) {
  const ethereumEth = await prisma.assetNetwork.upsert({
    where: {
      assetId_chainId_contractAddressNormalized: {
        assetId: assets.eth.id,
        chainId: chains.ethereum.id,
        contractAddressNormalized: '',
      },
    },
    update: {
      standard: TokenStandard.NATIVE,
      memoPolicy: MemoPolicy.NONE,
      isActive: true,
    },
    create: {
      assetId: assets.eth.id,
      chainId: chains.ethereum.id,
      standard: TokenStandard.NATIVE,
      memoPolicy: MemoPolicy.NONE,
    },
  });

  const tronTrx = await prisma.assetNetwork.upsert({
    where: {
      assetId_chainId_contractAddressNormalized: {
        assetId: assets.trx.id,
        chainId: chains.tron.id,
        contractAddressNormalized: '',
      },
    },
    update: {
      standard: TokenStandard.NATIVE,
      memoPolicy: MemoPolicy.NONE,
      isActive: true,
    },
    create: {
      assetId: assets.trx.id,
      chainId: chains.tron.id,
      standard: TokenStandard.NATIVE,
      memoPolicy: MemoPolicy.NONE,
    },
  });

  const solanaSol = await prisma.assetNetwork.upsert({
    where: {
      assetId_chainId_contractAddressNormalized: {
        assetId: assets.sol.id,
        chainId: chains.solana.id,
        contractAddressNormalized: '',
      },
    },
    update: {
      standard: TokenStandard.NATIVE,
      memoPolicy: MemoPolicy.NONE,
      isActive: true,
    },
    create: {
      assetId: assets.sol.id,
      chainId: chains.solana.id,
      standard: TokenStandard.NATIVE,
      memoPolicy: MemoPolicy.NONE,
    },
  });

  const ethereumUsdc = await prisma.assetNetwork.upsert({
    where: {
      assetId_chainId_contractAddressNormalized: {
        assetId: assets.usdc.id,
        chainId: chains.ethereum.id,
        contractAddressNormalized: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      },
    },
    update: {
      standard: TokenStandard.ERC20,
      decimals: 6,
      memoPolicy: MemoPolicy.NONE,
      isActive: true,
    },
    create: {
      assetId: assets.usdc.id,
      chainId: chains.ethereum.id,
      standard: TokenStandard.ERC20,
      contractAddressRaw: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      contractAddressNormalized: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      decimals: 6,
      memoPolicy: MemoPolicy.NONE,
    },
  });

  const tronUsdc = await prisma.assetNetwork.upsert({
    where: {
      assetId_chainId_contractAddressNormalized: {
        assetId: assets.usdc.id,
        chainId: chains.tron.id,
        contractAddressNormalized: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8',
      },
    },
    update: {
      standard: TokenStandard.TRC20,
      decimals: 6,
      memoPolicy: MemoPolicy.NONE,
      isActive: true,
    },
    create: {
      assetId: assets.usdc.id,
      chainId: chains.tron.id,
      standard: TokenStandard.TRC20,
      contractAddressRaw: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8',
      contractAddressNormalized: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8',
      decimals: 6,
      memoPolicy: MemoPolicy.NONE,
    },
  });

  const solanaUsdc = await prisma.assetNetwork.upsert({
    where: {
      assetId_chainId_contractAddressNormalized: {
        assetId: assets.usdc.id,
        chainId: chains.solana.id,
        contractAddressNormalized: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      },
    },
    update: {
      standard: TokenStandard.SPL,
      decimals: 6,
      memoPolicy: MemoPolicy.NONE,
      isActive: true,
    },
    create: {
      assetId: assets.usdc.id,
      chainId: chains.solana.id,
      standard: TokenStandard.SPL,
      contractAddressRaw: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      contractAddressNormalized: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      decimals: 6,
      memoPolicy: MemoPolicy.NONE,
    },
  });

  const baseUsdc = await prisma.assetNetwork.upsert({
    where: {
      assetId_chainId_contractAddressNormalized: {
        assetId: assets.usdc.id,
        chainId: chains.base.id,
        contractAddressNormalized: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      },
    },
    update: {
      standard: TokenStandard.ERC20,
      decimals: 6,
      memoPolicy: MemoPolicy.NONE,
      isActive: true,
    },
    create: {
      assetId: assets.usdc.id,
      chainId: chains.base.id,
      standard: TokenStandard.ERC20,
      contractAddressRaw: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      contractAddressNormalized: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      decimals: 6,
      memoPolicy: MemoPolicy.NONE,
    },
  });

  const bnbSmartChainUsdc = await prisma.assetNetwork.upsert({
    where: {
      assetId_chainId_contractAddressNormalized: {
        assetId: assets.usdc.id,
        chainId: chains.bnbSmartChain.id,
        contractAddressNormalized: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
      },
    },
    update: {
      standard: TokenStandard.ERC20,
      decimals: 18,
      memoPolicy: MemoPolicy.NONE,
      isActive: true,
    },
    create: {
      assetId: assets.usdc.id,
      chainId: chains.bnbSmartChain.id,
      standard: TokenStandard.ERC20,
      contractAddressRaw: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      contractAddressNormalized: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
      decimals: 18,
      memoPolicy: MemoPolicy.NONE,
    },
  });

  return {
    'ethereum:usdc': ethereumUsdc,
    'tron:usdc': tronUsdc,
    'ethereum:eth': ethereumEth,
    'tron:trx': tronTrx,
    'solana:sol': solanaSol,
    'solana:usdc': solanaUsdc,
    'base:usdc': baseUsdc,
    'bnb-smart-chain:usdc': bnbSmartChainUsdc,
  };
}

async function ensureDirectoryPartner(seed: PartnerSeed) {
  return prisma.partner.upsert({
    where: {
      slug: seed.slug,
    },
    update: {
      displayName: seed.displayName,
      partnerType: seed.partnerType,
      status: PartnerStatus.ACTIVE,
      isDirectoryListed: seed.isDirectoryListed ?? true,
      apiConsumerEnabled: seed.apiConsumerEnabled,
      dataPartnerEnabled: seed.dataPartnerEnabled,
      fullAttestationPartnerEnabled: seed.fullAttestationPartnerEnabled,
      webhooksEnabled: seed.webhooksEnabled,
      batchVerificationEnabled: seed.batchVerificationEnabled,
      auditExportsEnabled: seed.auditExportsEnabled,
      sandboxEnabled: seed.sandboxEnabled,
      productionEnabled: seed.productionEnabled,
      onboardingStage: seed.onboardingStage,
      feedHealthStatus: seed.feedHealthStatus,
      countryCode: seed.countryCode,
      metadata: {
        ...(seed.metadata ?? {}),
        seeded: 'phase21',
      },
    },
    create: {
      slug: seed.slug,
      displayName: seed.displayName,
      partnerType: seed.partnerType,
      status: PartnerStatus.ACTIVE,
      isDirectoryListed: seed.isDirectoryListed ?? true,
      apiConsumerEnabled: seed.apiConsumerEnabled,
      dataPartnerEnabled: seed.dataPartnerEnabled,
      fullAttestationPartnerEnabled: seed.fullAttestationPartnerEnabled,
      webhooksEnabled: seed.webhooksEnabled,
      batchVerificationEnabled: seed.batchVerificationEnabled,
      auditExportsEnabled: seed.auditExportsEnabled,
      sandboxEnabled: seed.sandboxEnabled,
      productionEnabled: seed.productionEnabled,
      onboardingStage: seed.onboardingStage,
      feedHealthStatus: seed.feedHealthStatus,
      countryCode: seed.countryCode,
      metadata: {
        ...(seed.metadata ?? {}),
        seeded: 'phase21',
      },
    },
  });
}

async function ensureSigningKey(
  partnerId: string,
  partnerSlug: string,
  partnerDisplayName: string,
) {
  const publicKeyPem = buildSeedPublicKeyPem(partnerSlug);
  const fingerprint = createHash('sha256').update(publicKeyPem).digest('hex');

  return prisma.partnerSigningKey.upsert({
    where: {
      partnerId_keyId: {
        partnerId,
        keyId: 'seed-ed25519-primary',
      },
    },
    update: {
      algorithm: SigningKeyAlgorithm.ED25519,
      publicKeyPem,
      fingerprint,
      status: SigningKeyStatus.ACTIVE,
      validFrom: new Date('2026-01-01T00:00:00.000Z'),
      validTo: null,
      rotatesAt: new Date('2026-12-31T00:00:00.000Z'),
      revokedAt: null,
    },
    create: {
      partnerId,
      keyId: 'seed-ed25519-primary',
      algorithm: SigningKeyAlgorithm.ED25519,
      publicKeyPem,
      fingerprint,
      status: SigningKeyStatus.ACTIVE,
      validFrom: new Date('2026-01-01T00:00:00.000Z'),
      rotatesAt: new Date('2026-12-31T00:00:00.000Z'),
    },
  });
}

async function ensureRecipientsForPartner(
  partnerId: string,
  signingKeyId: string,
  recipientSeeds: RecipientSeed[],
  assetNetworks: Record<string, { id: string }>,
  sequenceOffset: number,
) {
  const records: Array<{
    recipient: Awaited<ReturnType<typeof prisma.recipient.upsert>>;
    identifier: Awaited<ReturnType<typeof prisma.recipientIdentifier.upsert>>;
    destination: Awaited<ReturnType<typeof prisma.recipientDestination.upsert>>;
    attestation: Awaited<ReturnType<typeof prisma.attestation.upsert>>;
  }> = [];

  for (const [index, recipientSeed] of recipientSeeds.entries()) {
    const assetNetwork =
      assetNetworks[`${recipientSeed.chainSlug}:${recipientSeed.assetCode}`];

    if (!assetNetwork) {
      throw new Error(
        `Missing asset network for ${recipientSeed.chainSlug}:${recipientSeed.assetCode}.`,
      );
    }

    const recipient = await prisma.recipient.upsert({
      where: {
        partnerId_externalRecipientId: {
          partnerId,
          externalRecipientId: recipientSeed.externalRecipientId,
        },
      },
      update: {
        displayName: recipientSeed.displayName,
        status: 'ACTIVE',
      },
      create: {
        partnerId,
        externalRecipientId: recipientSeed.externalRecipientId,
        displayName: recipientSeed.displayName,
      },
    });

    const identifier = await prisma.recipientIdentifier.upsert({
      where: {
        partnerId_kind_normalizedValue: {
          partnerId,
          kind: IdentifierKind.PARTNER_HANDLE,
          normalizedValue: recipientSeed.identifier.toLowerCase(),
        },
      },
      update: {
        recipientId: recipient.id,
        rawValue: recipientSeed.identifier,
        status: IdentifierStatus.ACTIVE,
        visibility: IdentifierVisibility.RESOLVABLE,
        isPrimary: true,
        verifiedAt: new Date('2026-02-01T09:00:00.000Z'),
        expiresAt: null,
      },
      create: {
        recipientId: recipient.id,
        partnerId,
        kind: IdentifierKind.PARTNER_HANDLE,
        rawValue: recipientSeed.identifier,
        normalizedValue: recipientSeed.identifier.toLowerCase(),
        status: IdentifierStatus.ACTIVE,
        visibility: IdentifierVisibility.RESOLVABLE,
        isPrimary: true,
        verifiedAt: new Date('2026-02-01T09:00:00.000Z'),
      },
    });

    const addressNormalized = evmSeedChains.has(recipientSeed.chainSlug)
      ? recipientSeed.destinationAddress.toLowerCase()
      : recipientSeed.destinationAddress;
    const effectiveFrom = new Date(
      `2026-02-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
    );
    const expiresAt =
      recipientSeed.chainSlug === 'tron'
        ? new Date('2026-06-30T00:00:00.000Z')
        : new Date('2026-09-30T00:00:00.000Z');

    const destination = await prisma.recipientDestination.upsert({
      where: {
        recipientId_assetNetworkId_addressNormalized_memoValue: {
          recipientId: recipient.id,
          assetNetworkId: assetNetwork.id,
          addressNormalized,
          memoValue: '',
        },
      },
      update: {
        addressRaw: recipientSeed.destinationAddress,
        status: DestinationStatus.ACTIVE,
        isDefault: true,
        effectiveFrom,
        lastAttestedAt: effectiveFrom,
        expiresAt,
        revokedAt: null,
      },
      create: {
        recipientId: recipient.id,
        assetNetworkId: assetNetwork.id,
        addressRaw: recipientSeed.destinationAddress,
        addressNormalized,
        memoValue: '',
        status: DestinationStatus.ACTIVE,
        isDefault: true,
        effectiveFrom,
        lastAttestedAt: effectiveFrom,
        expiresAt,
      },
    });

    const payload = {
      recipientIdentifier: recipientSeed.identifier,
      recipientDisplayName: recipientSeed.displayName,
      chain: recipientSeed.chainSlug,
      asset: recipientSeed.assetCode.toUpperCase(),
      address: recipientSeed.destinationAddress,
      disclosureMode: 'FULL_LABEL',
      lookupDirection: 'BOTH',
    };
    const canonicalPayload = JSON.stringify(payload);
    const payloadHash = createHash('sha256')
      .update(canonicalPayload)
      .digest('hex');

    const attestation = await prisma.attestation.upsert({
      where: {
        partnerId_sequenceNumber: {
          partnerId,
          sequenceNumber: BigInt(sequenceOffset + index + 1),
        },
      },
      update: {
        signingKeyId,
        attestationType: AttestationType.DESTINATION_ASSIGNMENT,
        recipientId: recipient.id,
        identifierId: identifier.id,
        assetNetworkId: assetNetwork.id,
        destinationId: destination.id,
        recipientIdentifierSnapshot: recipientSeed.identifier,
        displayNameSnapshot: recipientSeed.displayName,
        addressRaw: recipientSeed.destinationAddress,
        addressNormalized,
        memoValue: '',
        canonicalPayload,
        payload,
        payloadHash,
        signature: `seed-signature-${partnerId}-${sequenceOffset + index + 1}`,
        issuedAt: effectiveFrom,
        effectiveFrom,
        expiresAt,
        verificationStatus: VerificationStatus.VERIFIED,
        verifiedAt: effectiveFrom,
        revokedAt: null,
      },
      create: {
        partnerId,
        signingKeyId,
        attestationType: AttestationType.DESTINATION_ASSIGNMENT,
        recipientId: recipient.id,
        identifierId: identifier.id,
        assetNetworkId: assetNetwork.id,
        destinationId: destination.id,
        recipientIdentifierSnapshot: recipientSeed.identifier,
        displayNameSnapshot: recipientSeed.displayName,
        addressRaw: recipientSeed.destinationAddress,
        addressNormalized,
        memoValue: '',
        canonicalPayload,
        payload,
        payloadHash,
        signature: `seed-signature-${partnerId}-${sequenceOffset + index + 1}`,
        sequenceNumber: BigInt(sequenceOffset + index + 1),
        issuedAt: effectiveFrom,
        effectiveFrom,
        expiresAt,
        verificationStatus: VerificationStatus.VERIFIED,
        verifiedAt: effectiveFrom,
      },
    });

    records.push({
      recipient,
      identifier,
      destination,
      attestation,
    });
  }

  return records;
}

async function ensurePartnerProductionCorridors(
  partnerId: string,
  recipients: Awaited<ReturnType<typeof ensureRecipientsForPartner>>,
) {
  const grantedAssetNetworkIds = new Set(
    recipients.map((record) => record.destination.assetNetworkId),
  );

  for (const assetNetworkId of grantedAssetNetworkIds) {
    await prisma.partnerProductionCorridor.upsert({
      where: {
        partnerId_assetNetworkId: {
          partnerId,
          assetNetworkId,
        },
      },
      update: {
        status: 'GRANTED',
        note: 'Seeded production corridor access for demo readiness.',
        grantedByIdentifier: 'seed-script',
        grantedAt: new Date('2026-03-11T16:00:00.000Z'),
        revokedAt: null,
      },
      create: {
        partnerId,
        assetNetworkId,
        status: 'GRANTED',
        note: 'Seeded production corridor access for demo readiness.',
        grantedByIdentifier: 'seed-script',
        grantedAt: new Date('2026-03-11T16:00:00.000Z'),
      },
    });
  }
}

async function ensurePartnerUser(params: {
  partnerId: string;
  email: string;
  fullName: string;
  role: PartnerUserRole;
  scopes: string[];
  password: string;
  lastLoginAt?: Date | null;
}) {
  const passwordHash = hashSecret(params.password);
  const lastLoginAt =
    params.lastLoginAt === undefined
      ? new Date('2026-03-11T14:00:00.000Z')
      : params.lastLoginAt;

  return prisma.partnerUser.upsert({
    where: {
      email: params.email,
    },
    update: {
      partnerId: params.partnerId,
      fullName: params.fullName,
      role: params.role,
      scopes: params.scopes,
      passwordHash,
      status: PartnerUserStatus.ACTIVE,
      disabledAt: null,
      lastLoginAt,
    },
    create: {
      partnerId: params.partnerId,
      email: params.email,
      fullName: params.fullName,
      role: params.role,
      scopes: params.scopes,
      passwordHash,
      status: PartnerUserStatus.ACTIVE,
      lastLoginAt,
    },
  });
}

async function ensurePartnerSecuritySettings(partnerId: string) {
  const existing = await prisma.partnerSecuritySettings.findUnique({
    where: {
      partnerId,
    },
  });

  if (existing) {
    return prisma.partnerSecuritySettings.update({
      where: {
        partnerId,
      },
      data: {
        sessionIdleTimeoutMinutes: 45,
        enforceMfa: false,
        ipAllowlist: ['102.88.34.0/24', '196.46.20.14/32'],
        credentialRotationDays: 90,
      },
    });
  }

  return prisma.partnerSecuritySettings.create({
    data: {
      partnerId,
      sessionIdleTimeoutMinutes: 45,
      enforceMfa: false,
      ipAllowlist: ['102.88.34.0/24', '196.46.20.14/32'],
      credentialRotationDays: 90,
    },
  });
}

async function ensurePendingProductionApprovalRequest(params: {
  partnerId: string;
  requestedByUserId: string;
  assetNetworkIds: string[];
  requestNote: string;
}) {
  const existingRequest = await prisma.partnerProductionApprovalRequest.findFirst({
    where: {
      partnerId: params.partnerId,
      status: ProductionApprovalRequestStatus.PENDING,
    },
    orderBy: {
      requestedAt: 'desc',
    },
  });

  const request = existingRequest
    ? await prisma.partnerProductionApprovalRequest.update({
        where: {
          id: existingRequest.id,
        },
        data: {
          requestNote: params.requestNote,
          requestedByUserId: params.requestedByUserId,
          reviewedAt: null,
          reviewedByIdentifier: null,
          reviewNote: null,
        },
      })
    : await prisma.partnerProductionApprovalRequest.create({
        data: {
          partnerId: params.partnerId,
          requestedByUserId: params.requestedByUserId,
          requestNote: params.requestNote,
          status: ProductionApprovalRequestStatus.PENDING,
          requestedAt: new Date('2026-03-13T12:00:00.000Z'),
        },
      });

  await prisma.partnerProductionApprovalRequestCorridor.deleteMany({
    where: {
      requestId: request.id,
    },
  });

  if (params.assetNetworkIds.length > 0) {
    await prisma.partnerProductionApprovalRequestCorridor.createMany({
      data: params.assetNetworkIds.map((assetNetworkId) => ({
        requestId: request.id,
        assetNetworkId,
      })),
    });
  }

  await prisma.partnerProductionApprovalApprovedCorridor.deleteMany({
    where: {
      requestId: request.id,
    },
  });

  return request;
}

async function ensureApiCredential(
  partnerId: string,
  label: string,
  scopes: string[],
) {
  const existing = await prisma.partnerApiCredential.findFirst({
    where: {
      partnerId,
      label,
    },
  });

  if (existing) {
    return prisma.partnerApiCredential.update({
      where: {
        id: existing.id,
      },
      data: {
        scopes,
        status: PartnerStatus.ACTIVE,
        revokedAt: null,
        lastUsedAt: new Date('2026-03-11T15:30:00.000Z'),
      },
    });
  }

  const generatedCredential = generateApiCredential();

  return prisma.partnerApiCredential.create({
    data: {
      partnerId,
      label,
      keyPrefix: generatedCredential.keyPrefix,
      secretHash: generatedCredential.secretHash,
      scopes,
      status: PartnerStatus.ACTIVE,
      lastUsedAt: new Date('2026-03-11T15:30:00.000Z'),
    },
  });
}

async function ensureWebhookEndpoint(partnerId: string) {
  const existing = await prisma.webhookEndpoint.findFirst({
    where: {
      partnerId,
      label: 'Primary settlement webhook',
    },
  });
  const signingSecretHash = hashSecret('whsec_ivorypay_demo_primary');

  if (existing) {
    return prisma.webhookEndpoint.update({
      where: {
        id: existing.id,
      },
      data: {
        url: 'https://hooks.ivorypay.example/vervet',
        signingSecretHash,
        signingSecretVersion: 1,
        eventTypes: [
          WebhookEventType.DESTINATION_UPDATED,
          WebhookEventType.DESTINATION_REVOKED,
          WebhookEventType.SIGNING_KEY_ROTATED,
        ],
        status: WebhookStatus.ACTIVE,
        lastDeliveredAt: new Date('2026-03-11T11:15:00.000Z'),
      },
    });
  }

  return prisma.webhookEndpoint.create({
    data: {
      partnerId,
      label: 'Primary settlement webhook',
      url: 'https://hooks.ivorypay.example/vervet',
      signingSecretHash,
      signingSecretVersion: 1,
      eventTypes: [
        WebhookEventType.DESTINATION_UPDATED,
        WebhookEventType.DESTINATION_REVOKED,
        WebhookEventType.SIGNING_KEY_ROTATED,
      ],
      status: WebhookStatus.ACTIVE,
      lastDeliveredAt: new Date('2026-03-11T11:15:00.000Z'),
    },
  });
}

async function ensureWebhookDeliveries(endpointId: string) {
  const deliveries = [
    {
      eventType: WebhookEventType.DESTINATION_UPDATED,
      payload: {
        seed: 'phase21',
        eventType: 'DESTINATION_UPDATED',
        recipient: 'merchant@ivorypay',
      },
      status: DeliveryStatus.SUCCEEDED,
      attemptCount: 1,
      nextAttemptAt: null,
      lastAttemptAt: new Date('2026-03-11T11:15:00.000Z'),
      responseCode: 200,
      lastError: null,
    },
    {
      eventType: WebhookEventType.DESTINATION_REVOKED,
      payload: {
        seed: 'phase21',
        eventType: 'DESTINATION_REVOKED',
        recipient: 'treasury@ivorypay',
      },
      status: DeliveryStatus.FAILED,
      attemptCount: 2,
      nextAttemptAt: new Date('2026-03-12T10:00:00.000Z'),
      lastAttemptAt: new Date('2026-03-11T12:20:00.000Z'),
      responseCode: 500,
      lastError: 'upstream_timeout',
    },
  ] as const;

  const payloadHashes = deliveries.map((delivery) =>
    createHash('sha256').update(JSON.stringify(delivery.payload)).digest('hex'),
  );

  await prisma.webhookDelivery.deleteMany({
    where: {
      endpointId,
      payloadHash: {
        in: payloadHashes,
      },
    },
  });

  await prisma.webhookDelivery.createMany({
    data: deliveries.map((delivery, index) => ({
      endpointId,
      eventType: delivery.eventType,
      payload: delivery.payload,
      payloadHash: payloadHashes[index],
      status: delivery.status,
      attemptCount: delivery.attemptCount,
      nextAttemptAt: delivery.nextAttemptAt,
      lastAttemptAt: delivery.lastAttemptAt,
      responseCode: delivery.responseCode,
      lastError: delivery.lastError,
      createdAt:
        delivery.lastAttemptAt ?? new Date('2026-03-11T10:45:00.000Z'),
      updatedAt:
        delivery.lastAttemptAt ?? new Date('2026-03-11T10:45:00.000Z'),
    })),
  });
}

async function ensureAuditLogs(params: {
  partnerId: string;
  ownerUserEmail: string;
}) {
  await prisma.auditLog.deleteMany({
    where: {
      subjectPartnerId: params.partnerId,
      actorIdentifier: 'seed:phase21',
    },
  });

  await prisma.auditLog.createMany({
    data: [
      {
        actorType: AuditActorType.SYSTEM,
        subjectPartnerId: params.partnerId,
        actorIdentifier: 'seed:phase21',
        action: 'partner.api_credential.issued',
        entityType: 'PartnerApiCredential',
        entityId: 'seed-production-resolver',
        summary: 'Issued production resolver credential for Ivorypay.',
        metadata: {
          label: 'Production Resolver',
        },
        createdAt: new Date('2026-03-11T10:00:00.000Z'),
      },
      {
        actorType: AuditActorType.USER,
        subjectPartnerId: params.partnerId,
        actorIdentifier: params.ownerUserEmail,
        action: 'partner.signing_key.registered',
        entityType: 'PartnerSigningKey',
        entityId: 'seed-ed25519-primary',
        summary: 'Registered the primary signing key for Ivorypay.',
        metadata: {
          seed: 'phase21',
        },
        createdAt: new Date('2026-03-11T10:15:00.000Z'),
      },
      {
        actorType: AuditActorType.SYSTEM,
        subjectPartnerId: params.partnerId,
        actorIdentifier: 'seed:phase21',
        action: 'attestation.ingested',
        entityType: 'Attestation',
        entityId: 'seed-attestation-merchant',
        summary: 'Ingested destination assignment for merchant@ivorypay.',
        metadata: {
          recipientIdentifier: 'merchant@ivorypay',
        },
        createdAt: new Date('2026-03-11T10:30:00.000Z'),
      },
    ],
  });
}

async function ensureResolutionRequests(params: {
  requesterPartnerId: string;
  requestedByUserId: string;
  bybitRecipient: SeedRecipientGraph;
  ivorypayRecipient: SeedRecipientGraph;
}) {
  await prisma.riskSignal.deleteMany({
    where: {
      resolutionRequest: {
        requesterPartnerId: params.requesterPartnerId,
        clientReference: {
          startsWith: 'seed:',
        },
      },
    },
  });
  await prisma.resolutionRequest.deleteMany({
    where: {
      requesterPartnerId: params.requesterPartnerId,
      clientReference: {
        startsWith: 'seed:',
      },
    },
  });

  const now = Date.now();
  const resolveRequestedAt = new Date(now - 1000 * 60 * 60 * 26);
  const confirmRequestedAt = new Date(now - 1000 * 60 * 60 * 20);
  const verifyRequestedAt = new Date(now - 1000 * 60 * 60 * 8);

  const resolveRequest = await prisma.resolutionRequest.create({
    data: {
      queryType: QueryType.RESOLVE,
      requesterPartnerId: params.requesterPartnerId,
      recipientIdentifierInput: params.bybitRecipient.identifier.rawValue,
      recipientIdentifierNormalized:
        params.bybitRecipient.identifier.normalizedValue,
      platformInput: null,
      chainInput: 'ethereum',
      assetInput: 'USDC',
      providedAddressRaw: null,
      providedAddressNormalized: null,
      resolvedRecipientId: params.bybitRecipient.recipient.id,
      resolvedIdentifierId: params.bybitRecipient.identifier.id,
      resolvedDestinationId: params.bybitRecipient.destination.id,
      resolvedAttestationId: params.bybitRecipient.attestation.id,
      outcome: ResolutionOutcome.RESOLVED,
      riskLevel: RiskLevel.LOW,
      recommendation: 'safe_to_send',
      flags: [],
      clientReference: 'seed:resolve:bybit',
      idempotencyKey: 'seed-resolve-bybit',
      requestFingerprint: 'seed-resolve-bybit',
      requestedAt: resolveRequestedAt,
      respondedAt: new Date(resolveRequestedAt.getTime() + 120),
      responseData: {
        lookupDirection: 'FORWARD_LOOKUP',
        disclosureMode: 'FULL_LABEL',
        recipientDisplayName: params.bybitRecipient.recipient.displayName,
        platform: 'bybit',
        address: params.bybitRecipient.destination.addressRaw,
        chain: 'ethereum',
        asset: 'USDC',
        verified: true,
        expiresAt: params.bybitRecipient.attestation.expiresAt?.toISOString() ?? null,
        riskLevel: 'LOW',
        flags: [],
        recommendation: 'safe_to_send',
      },
      metadata: {
        seed: 'phase21',
        lookupDirection: 'FORWARD_LOOKUP',
        disclosureMode: 'FULL_LABEL',
        requestedByUserId: params.requestedByUserId,
      },
    },
  });

  const confirmRequest = await prisma.resolutionRequest.create({
    data: {
      queryType: QueryType.CONFIRM_ADDRESS,
      requesterPartnerId: params.requesterPartnerId,
      recipientIdentifierInput: 'bybit',
      recipientIdentifierNormalized: 'bybit',
      platformInput: 'bybit',
      chainInput: 'ethereum',
      assetInput: 'USDC',
      providedAddressRaw: params.bybitRecipient.destination.addressRaw,
      providedAddressNormalized: params.bybitRecipient.destination.addressNormalized,
      resolvedRecipientId: params.bybitRecipient.recipient.id,
      resolvedIdentifierId: params.bybitRecipient.identifier.id,
      resolvedDestinationId: params.bybitRecipient.destination.id,
      resolvedAttestationId: params.bybitRecipient.attestation.id,
      outcome: ResolutionOutcome.RESOLVED,
      riskLevel: RiskLevel.LOW,
      recommendation: 'safe_to_send',
      flags: [],
      clientReference: 'seed:confirm:bybit',
      idempotencyKey: 'seed-confirm-bybit',
      requestFingerprint: 'seed-confirm-bybit',
      requestedAt: confirmRequestedAt,
      respondedAt: new Date(confirmRequestedAt.getTime() + 90),
      responseData: {
        lookupDirection: 'REVERSE_LOOKUP',
        disclosureMode: 'FULL_LABEL',
        confirmed: true,
        verified: true,
        recipientDisplayName: params.bybitRecipient.recipient.displayName,
        platform: 'bybit',
        chain: 'ethereum',
        asset: 'USDC',
        expiresAt: params.bybitRecipient.attestation.expiresAt?.toISOString() ?? null,
        riskLevel: 'LOW',
        flags: [],
        recommendation: 'safe_to_send',
      },
      metadata: {
        seed: 'phase21',
        lookupDirection: 'REVERSE_LOOKUP',
        disclosureMode: 'FULL_LABEL',
        requestedByUserId: params.requestedByUserId,
      },
    },
  });

  const verifyRequest = await prisma.resolutionRequest.create({
    data: {
      queryType: QueryType.VERIFY_ADDRESS,
      requesterPartnerId: params.requesterPartnerId,
      recipientIdentifierInput: params.bybitRecipient.identifier.rawValue,
      recipientIdentifierNormalized:
        params.bybitRecipient.identifier.normalizedValue,
      platformInput: null,
      chainInput: 'ethereum',
      assetInput: 'USDC',
      providedAddressRaw: params.ivorypayRecipient.destination.addressRaw,
      providedAddressNormalized:
        params.ivorypayRecipient.destination.addressNormalized,
      resolvedRecipientId: params.bybitRecipient.recipient.id,
      resolvedIdentifierId: params.bybitRecipient.identifier.id,
      resolvedDestinationId: params.bybitRecipient.destination.id,
      resolvedAttestationId: params.bybitRecipient.attestation.id,
      outcome: ResolutionOutcome.MISMATCH,
      riskLevel: RiskLevel.HIGH,
      recommendation: 'do_not_send',
      flags: [RiskSignalKind.ADDRESS_MISMATCH],
      clientReference: 'seed:verify:mismatch',
      idempotencyKey: 'seed-verify-mismatch',
      requestFingerprint: 'seed-verify-mismatch',
      requestedAt: verifyRequestedAt,
      respondedAt: new Date(verifyRequestedAt.getTime() + 80),
      responseData: {
        lookupDirection: 'TRANSFER_VERIFICATION',
        disclosureMode: 'FULL_LABEL',
        match: false,
        verified: false,
        recipientDisplayName: params.bybitRecipient.recipient.displayName,
        platform: 'bybit',
        riskLevel: 'HIGH',
        flags: ['ADDRESS_MISMATCH'],
        recommendation: 'do_not_send',
      },
      metadata: {
        seed: 'phase21',
        lookupDirection: 'TRANSFER_VERIFICATION',
        disclosureMode: 'FULL_LABEL',
        requestedByUserId: params.requestedByUserId,
      },
    },
  });

  await prisma.riskSignal.createMany({
    data: [
      {
        resolutionRequestId: verifyRequest.id,
        kind: RiskSignalKind.ADDRESS_MISMATCH,
        severity: RiskLevel.HIGH,
        details: {
          expected: params.bybitRecipient.destination.addressRaw,
          received: params.ivorypayRecipient.destination.addressRaw,
        },
      },
    ],
  });

  void resolveRequest;
  void confirmRequest;
}

type SeedRecipientGraph = {
  recipient: {
    id: string;
    displayName: string | null;
  };
  identifier: {
    id: string;
    rawValue: string;
    normalizedValue: string;
  };
  destination: {
    id: string;
    addressRaw: string;
    addressNormalized: string;
  };
  attestation: {
    id: string;
    expiresAt: Date | null;
  };
};

function findRecipientSeedData(
  seededPartners: Array<{
    partner: { slug: string };
    recipients: Array<{
      recipient: { id: string; displayName: string | null };
      identifier: { id: string; rawValue: string; normalizedValue: string };
      destination: { id: string; addressRaw: string; addressNormalized: string };
      attestation: { id: string; expiresAt: Date | null };
    }>;
  }>,
  partnerSlug: string,
  identifier: string,
): SeedRecipientGraph {
  const partner = seededPartners.find((entry) => entry.partner.slug === partnerSlug);

  if (!partner) {
    throw new Error(`Seeded partner '${partnerSlug}' was not found.`);
  }

  const record = partner.recipients.find(
    (entry) => entry.identifier.rawValue === identifier,
  );

  if (!record) {
    throw new Error(
      `Seeded identifier '${identifier}' was not found for '${partnerSlug}'.`,
    );
  }

  return record;
}

function buildSeedPublicKeyPem(partnerSlug: string): string {
  const keyBody = Buffer.from(`seed-public-key-${partnerSlug}`).toString(
    'base64',
  );

  return `-----BEGIN PUBLIC KEY-----\n${keyBody}\n-----END PUBLIC KEY-----`;
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    await prisma.$disconnect();
    throw error;
  });
