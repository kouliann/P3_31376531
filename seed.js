const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('Secret123!', 10);
  await prisma.user.create({
    data: {
      nombreCompleto: 'Usuario Prueba 2',
      email: 'prueba2@example.com',
      passwordHash: hash,
      role: 'user'
    }
  });
  console.log('Semillita plantada2');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());