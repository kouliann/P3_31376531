const getPrisma = require('./src/db/prismaClient');
const bcrypt = require('bcrypt');
require('dotenv').config();

const prisma = getPrisma();

async function main() {
  const hash = await bcrypt.hash('Secret123!', 10);
  await prisma.user.upsert({
    where: { email: 'prueba2@example.com' },
    update: {},
    create: {
      nombreCompleto: 'Usuario Prueba 2',
      email: 'prueba2@example.com',
      passwordHash: hash,
      role: 'user'
    }
  });
  console.log('usuario creado');

  const tag = await prisma.tag.upsert({
    where: { name: 'Sabrina Carpenter' },
    update: {},
    create: { name: 'Sabrina Carpenter' }
  });
  console.log('tags creados');

  const category = await prisma.category.upsert({
    where: { name: 'pop' },
    update: {},
    create: {
      name: 'pop',
      description: 'musica popular con sonidos pegajosos y ritmos bailables'
    }
  });

  // Create an album for the category and connect it to the created tag
  await prisma.albums.upsert({
    where: { slug: 'short-n-sweet' },
    update: {},
    create: {
      name: "Short n' Sweet",
      slug: 'short-n-sweet',
      description: "Siendo el sexto album de estudio de Sabrina, se posiciona como la catapulta que eleva su carrera, este album refleja su evolución artística y personal, consolidándola como una de las voces más influyentes de su generación, este album explora como sabrina ve sus relaciones romanticas pasadas y como estas la han cambiado.",
      price: 10.99,
      stock: 100,
      author: "Sabrina Carpenter",
      discography: "Island Records",
      deluxeVersion: true,
      category: { connect: { id: category.id } },
      tags: { connect: [{ id: tag.id }] }
    }
  });


}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());