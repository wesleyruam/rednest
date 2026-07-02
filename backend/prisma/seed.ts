import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function seedUsers(): Promise<void> {
  const defaults = [
    {
      username: process.env.SEED_ADMIN_USERNAME ?? 'admin',
      email: process.env.SEED_ADMIN_EMAIL ?? 'admin@rednest.local',
      password: process.env.SEED_ADMIN_PASSWORD ?? 'admin123',
      role: 'admin' as const,
    },
    { username: 'analyst', email: 'analyst@rednest.local', password: 'analyst123', role: 'analyst' as const },
    { username: 'viewer', email: 'viewer@rednest.local', password: 'viewer123', role: 'viewer' as const },
  ];

  for (const u of defaults) {
    const passwordHash = await argon2.hash(u.password, { type: argon2.argon2id });
    await prisma.user.upsert({
      where: { username: u.username },
      update: { email: u.email, role: u.role, passwordHash },
      create: { username: u.username, email: u.email, role: u.role, passwordHash },
    });
  }
}

async function main(): Promise<void> {
  console.log('🌱 Limpando dados de domínio...');
  await prisma.monitor.deleteMany();
  await prisma.report.deleteMany();
  await prisma.evidence.deleteMany();
  await prisma.iocRelation.deleteMany();
  await prisma.timelineEvent.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.ioc.deleteMany();
  await prisma.engagementData.deleteMany();
  await prisma.engagement.deleteMany();
  await prisma.operation.deleteMany();

  console.log('👤 Criando usuários de acesso...');
  await seedUsers();

  console.log('✅ Seed concluído (apenas usuários, sem dados fictícios).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
