import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const credential = await prisma.partnerApiCredential.findFirst({
    where: {
      revokedAt: null,
    },
    select: {
      id: true,
      label: true,
      keyPrefix: true,
    },
  });

  if (credential) {
    console.log(
      `FOUND CREDENTIAL: ${credential.keyPrefix} (${credential.label}) [${credential.id}]`,
    );
  } else {
    console.log('NO ACTIVE CREDENTIAL FOUND.');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
