// Idempotente: cria os usuários de acesso apenas se ainda não existirem.
// Diferente do seed, NÃO apaga nenhum dado — seguro para rodar a cada boot.
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');

const prisma = new PrismaClient();

async function main() {
  const users = [
    {
      username: process.env.SEED_ADMIN_USERNAME || 'admin',
      email: process.env.SEED_ADMIN_EMAIL || 'admin@rednest.local',
      password: process.env.SEED_ADMIN_PASSWORD || 'admin123',
      role: 'admin',
    },
    { username: 'analyst', email: 'analyst@rednest.local', password: 'analyst123', role: 'analyst' },
    { username: 'viewer', email: 'viewer@rednest.local', password: 'viewer123', role: 'viewer' },
  ];

  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { username: u.username } });
    if (existing) continue;
    const passwordHash = await argon2.hash(u.password, { type: argon2.argon2id });
    await prisma.user.create({
      data: { username: u.username, email: u.email, role: u.role, passwordHash },
    });
    console.log('usuário criado:', u.username);
  }
  console.log('usuários garantidos.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
