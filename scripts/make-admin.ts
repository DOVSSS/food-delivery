import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.update({
    where: { email: 'admin@test.com' },
    data: { role: 'ADMIN' },
  });
  console.log('Done:', user.email, user.role);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());