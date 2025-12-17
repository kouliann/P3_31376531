const path = require('path');
let prismaInstance;

function getPrisma() {
	if (!prismaInstance) {
		const { PrismaClient } = require('@prisma/client');

		// Safety guard: when running tests, ensure DATABASE_URL isn't accidentally pointing to the
		// production local DB file (dev.db). Tests should use `test/useTestDb.js` which sets a temporary DB.
		const dbUrl = process.env.DATABASE_URL || '';
		const isTest = process.env.NODE_ENV === 'test' || (process.argv && process.argv.join(' ').includes('jest'));
		const normalized = dbUrl.replace(/^file:/i, '').toLowerCase();
		const devDbPath = path.resolve(process.cwd(), 'prisma', 'dev.db').toLowerCase();
		if (isTest && normalized && devDbPath.endsWith(path.basename(normalized))) {
			// If the DB points to the repository dev.db path while running tests, abort to prevent accidental wipes
			throw new Error(`Refusing to instantiate PrismaClient using production DB path (${dbUrl}) while running tests. Ensure test helper (test/useTestDb.js) is loaded before any Prisma code.`);
		}

		prismaInstance = new PrismaClient();
	}
	return prismaInstance;
}

module.exports = getPrisma;