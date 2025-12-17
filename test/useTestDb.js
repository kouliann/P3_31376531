const fs = require('fs');
const path = require('path');
const os = require('os');

// This helper should be required at the very top of test files
// before any PrismaClient or app modules are imported.

// Load .env.test if present so we respect test env vars
try { require('dotenv').config({ path: path.resolve(process.cwd(), '.env.test') }); } catch (e) {}

const devDbPath = path.resolve(process.cwd(), 'prisma', 'dev.db');
if (!fs.existsSync(devDbPath)) {
  // If there's no dev.db, no copy is needed; but ensure DATABASE_URL is set if present in env
  if (process.env.DATABASE_URL) {
    // leave it
  }
  // Export a noop object so requiring this file is safe.
  module.exports = {};
} else {
  // Create a temp copy for this test run
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-test-'));
  const tmpDbPath = path.join(tmpDir, 'test.db');
  fs.copyFileSync(devDbPath, tmpDbPath);

  // Point Prisma to the temp DB file (SQLite file URL format)
  process.env.DATABASE_URL = `file:${tmpDbPath}`;

  // optional: also set NODE_ENV=test
  process.env.NODE_ENV = 'test';

  // Ensure the temp DB is removed on exit
  function cleanup() {
    try { fs.unlinkSync(tmpDbPath); } catch (e) {}
    try { fs.rmdirSync(tmpDir); } catch (e) {}
  }
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(130); });
  process.on('SIGTERM', () => { cleanup(); process.exit(137); });

  module.exports = { tmpDbPath };
}


// Create a temp copy for this test run
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-test-'));
const tmpDbPath = path.join(tmpDir, 'test.db');
fs.copyFileSync(devDbPath, tmpDbPath);

// Point Prisma to the temp DB file (SQLite file URL format)
process.env.DATABASE_URL = `file:${tmpDbPath}`;
console.log(`[useTestDb] Using test DB at: ${tmpDbPath}`);

// optional: also set NODE_ENV=test
process.env.NODE_ENV = 'test';

// Ensure the temp DB is removed on exit
function cleanup() {
  try { fs.unlinkSync(tmpDbPath); } catch (e) {}
  try { fs.rmdirSync(tmpDir); } catch (e) {}
}
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });
process.on('SIGTERM', () => { cleanup(); process.exit(137); });

module.exports = { tmpDbPath };
