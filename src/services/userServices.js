const { PrismaClient, Prisma } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

function stripPassword(user) {
  if (!user) return null;
  // remove sensitive fields before returning
  const { passwordHash, ...safe } = user;
  return safe;
}

class UserService {
  async registerUser(nombreCompleto, email, password, role = 'user') {
    const passwordHash = await bcrypt.hash(password, 10);
    try {
      const created = await prisma.user.create({
        data: { nombreCompleto, email, passwordHash, role }
      });
      return stripPassword(created);
    } catch (err) {
      // Bubble Prisma unique constraint so caller can map to 409
      throw err;
    }
  }

   async authenticateUser(email, password) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return null;

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;

    return stripPassword(user);
  }

  async getUserById(id) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, nombreCompleto: true, email: true, role: true, createdAt: true, updatedAt: true }
    });
    return user || null;
  }

  async getAllUsers() {
    return prisma.user.findMany({
      select: { id: true, nombreCompleto: true, email: true, role: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateUser(id, changes = {}) {
    const data = {};
    if (typeof changes.nombreCompleto !== 'undefined') data.nombreCompleto = changes.nombreCompleto;
    if (typeof changes.email !== 'undefined') data.email = changes.email;
    if (typeof changes.role !== 'undefined') data.role = changes.role;
    if (typeof changes.password !== 'undefined') {
      data.passwordHash = await bcrypt.hash(changes.password, 10);
    }

    if (Object.keys(data).length === 0) {
      return this.getUserById(id);
    }

    try {
      const updated = await prisma.user.update({
        where: { id },
        data,
        select: { id: true, nombreCompleto: true, email: true, role: true, createdAt: true, updatedAt: true }
      });
      return updated;
    } catch (err) {
      // rethrow to let route map Prisma errors (P2002 unique, P2025 not found)
      throw err;
    }
  }

  async deleteUser(id) {
    try {
      await prisma.user.delete({ where: { id } });
      return true;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return false;
      }
      throw err;
    }
  }
}

module.exports = UserService;