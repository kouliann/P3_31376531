let prismaInstance;

function getPrisma() {
	if (!prismaInstance) {
		const { PrismaClient } = require('@prisma/client');
		prismaInstance = new PrismaClient();
	}
	return prismaInstance;
}

module.exports = getPrisma;