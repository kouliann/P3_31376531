const getPrisma = require('../db/prismaClient');
const prisma = getPrisma();

class AlbumsRepository {
  async findById(id, opts = {}) {
    return prisma.albums.findUnique({ where: { id: Number(id) }, ...opts });
  }

  async findMany(queryOpts = {}) {
    return prisma.albums.findMany(queryOpts);
  }

  async count(queryWhere = {}) {
    return prisma.albums.count({ where: queryWhere });
  }
}

module.exports = AlbumsRepository;