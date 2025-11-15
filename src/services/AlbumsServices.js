const { PrismaClient } = require('@prisma/client');
const slugify = require('slugify');
const auth = require('../../middleware/auth');

const AlbumsRepository = require('../repositories/AlbumsRepository');
const AlbumsQueryBuilder = require('./AlbumsQueryBuilder');
const repository = new AlbumsRepository();

const prisma = new PrismaClient();

async function makeUniqueSlug(base) {
  let slug = slugify(base, { lower: true, strict: true });
  let candidate = slug;
  let i = 1;
  while (await prisma.albums.findUnique({ where: { slug: candidate } })) {
    candidate = `${slug}-${i++}`;
  }
  return candidate;
}

class AlbumsService {

  async createAlbums(data) {
    if (!data.name) throw new Error('Nombre requerido');
    const slug = await makeUniqueSlug(data.name);
    const createData = {
      name: data.name,
      slug,
      description: data.description || null,
      price: typeof data.price !== 'undefined' ? Number(data.price) : 0,
      stock: typeof data.stock !== 'undefined' ? Number(data.stock) : 0,
      author: data.author || null,
      discography: data.discography || null,
      deluxeVersion: !!data.deluxeVersion
    };

    // categoría: preferir nombre (connectOrCreate) o categoryId (connect) comprobando existencia
    if (typeof data.categoryId !== 'undefined' && data.categoryId !== null && data.categoryId !== '') {
      const catId = Number(data.categoryId);
      if (Number.isNaN(catId)) throw new Error('categoryId debe ser numérico');
      const existing = await prisma.category.findUnique({ where: { id: catId } });
      if (!existing) throw new Error(`Category con id ${catId} no encontrada`);
      createData.category = { connect: { id: catId } };
    } else if (data.category && typeof data.category === 'string') {
      createData.category = {
        connectOrCreate: {
          where: { name: data.category },
          create: { name: data.category, description: data.categoryDescription || null }
        }
      };
    } else {
      throw new Error('Se requiere categoryId (num) o category (nombre)');
    }

    // tags: soportar tagIds (nums) o tags (nombres). Normalizar cada elemento.
    if (Array.isArray(data.tagIds) && data.tagIds.length) {
      createData.tags = { connect: data.tagIds.map(id => ({ id: Number(id) })) };
    } else if (Array.isArray(data.tags) && data.tags.length) {
      // separar elementos numéricos (ids) de strings (names)
      const ids = data.tags.filter(t => typeof t === 'number' || (typeof t === 'string' && /^\d+$/.test(t))).map(Number);
      const names = data.tags.filter(t => typeof t === 'string' && !/^\d+$/.test(t));

      const tagOps = [];
      if (ids.length) tagOps.push(...ids.map(id => ({ connect: { id } })));
      if (names.length) tagOps.push(...names.map(name => ({
        connectOrCreate: { where: { name }, create: { name } }
      })));

      // si sólo hay connect ops usamos { connect: [...] } sino usamos connectOrCreate cuando haya names
      if (ids.length && !names.length) {
        createData.tags = { connect: ids.map(id => ({ id })) };
      } else if (!ids.length && names.length) {
        createData.tags = { connectOrCreate: names.map(name => ({ where: { name }, create: { name } })) };
      } else {
        // mezcla: primero crear/connectNames (upsert) y luego conectar ids en dos pasos
        // estrategia: upsert names -> obtener sus ids -> conectar todos por id
        const connected = [];
        for (const name of names) {
          const t = await prisma.tag.upsert({ where: { name }, update: {}, create: { name } });
          connected.push({ id: t.id });
        }
        connected.push(...ids.map(id => ({ id })));
        createData.tags = { connect: connected };
      }
    }

    const Albums = await prisma.albums.create({ data: createData, include: { category: true, tags: true } });
    return Albums;
  }

async getAllAlbums() {
    return prisma.albums.findMany({ include: { category: true, tags: true }, orderBy: { createdAt: 'desc' }});
}

  async updateAlbums(id, changes = {}) {
    const prodId = Number(id);
    const data = {};
    if (changes.name) {
      data.name = changes.name;
      data.slug = await makeUniqueSlug(changes.name);
    }
    if (typeof changes.description !== 'undefined') data.description = changes.description;
    if (typeof changes.price !== 'undefined') data.price = Number(changes.price);
    if (typeof changes.stock !== 'undefined') data.stock = Number(changes.stock);
    if (typeof changes.author !== 'undefined') data.author = changes.author;
    if (typeof changes.discography !== 'undefined') data.discography = changes.discography;
    if (typeof changes.deluxeVersion !== 'undefined') data.deluxeVersion = changes.deluxeVersion;
    if (typeof changes.categoryId !== 'undefined') data.category = { connect: { id: Number(changes.categoryId) } };
    if (changes.tagIds) {
      data.tags = { set: [], connect: changes.tagIds.map(id => ({ id: Number(id) })) };
    }

    if (typeof changes.categoryId !== 'undefined' && changes.categoryId !== null) {
      data.category = { connect: { id: Number(changes.categoryId) } };
    } else if (typeof changes.category === 'string') {
      const cat = await prisma.category.upsert({
        where: { name: changes.category },
        update: {},
        create: { name: changes.category, description: changes.categoryDescription || null }
      });
      data.category = { connect: { id: cat.id } };
    }

    if (Array.isArray(changes.tagIds)) {
      data.tags = { set: changes.tagIds.map(id => ({ id: Number(id) })) };
    } else if (Array.isArray(changes.tags)) {
      // ensure tags exist (upsert) then connect
       const connectedTagIds = [];
  if (Array.isArray(changes.tags) && changes.tags.length) {
    // Normalizar items
    const rawTags = changes.tags;
    const ids = rawTags
      .map(t => (typeof t === 'number' ? t : (typeof t === 'string' && /^\d+$/.test(t) ? Number(t) : null)))
      .filter(Boolean);
    const names = rawTags
      .filter(t => typeof t === 'string' && !/^\d+$/.test(t))
      .map(String);

    // Conectar por id
    for (const id of ids) {
      const existing = await prisma.tag.findUnique({ where: { id: Number(id) } });
      if (existing) connectedTagIds.push(existing.id);
    }

    // Upsert por nombre para asegurar existencia
    for (const name of names) {
      const t = await prisma.tag.upsert({
        where: { name },
        update: {},
        create: { name }
      });
      connectedTagIds.push(t.id);
    }
  }

    const updated = await prisma.albums.update({
      where: { id: prodId },
      data,
      include: { category: true, tags: true }
    });
    return updated;
  }
}

  async getAlbumsById(id) {
    const albumId = Number(id);
    if (Number.isNaN(albumId)) return null;
    return prisma.albums.findUnique({
      where: { id: albumId },
      include: { category: true, tags: true }
    });
  }

  /**
   * Búsqueda pública avanzada con paginación y filtros.
   * filters: { page, limit, category, tags, price_min, price_max, search, author, discography, deluxeVersion }
   */


  async search(filters = {}) {
    // construir query dinámicamente
    const builder = new AlbumsQueryBuilder()
      .pagination(filters.page, filters.limit)
      .category(filters.category)
      .tags(filters.tags)
      .priceRange(filters.price_min, filters.price_max)
      .search(filters.search)
      .author(filters.author)
      .discography(filters.discography)
      .deluxeVersion(filters.deluxeVersion)
      .orderBy(filters.orderBy);

    const opts = builder.build();

     // log del objeto que se pasará a Prisma
+      console.log('[AlbumsService.search] prisma opts:', JSON.stringify(opts, null, 2));

    // total count and items via repository
    const [total, items] = await Promise.all([
      repository.count(opts.where || {}),
      repository.findMany(opts)
    ]);

    return {
      items,
      meta: {
        page: Math.max(1, Number(filters.page) || 1),
        limit: Math.min(100, Math.max(1, Number(filters.limit) || 10)),
        total,
        totalPages: Math.ceil(total / (opts.take || 10)) || 1
      }
    };
  }

  async deleteAlbums(id) {
    await prisma.albums.delete({ where: { id: Number(id) }});
    return true;
  }
}

module.exports = AlbumsService;