import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

let prisma: PrismaClient;
export let pgliteClient: unknown = null;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

if (process.env.NODE_ENV === "test") {
  // Test Environment: Fully isolated in-memory PGlite database (not globally cached across test files)
  const { PGlite } = require(/* eslint-disable-line @typescript-eslint/no-require-imports */ "@electric-sql/pglite");
  const { PrismaPGlite } = require(/* eslint-disable-line @typescript-eslint/no-require-imports */ "pglite-prisma-adapter");
  
  pgliteClient = new PGlite();
  const adapter = new PrismaPGlite(pgliteClient);
  
  prisma = new PrismaClient({ adapter });
} else {
  if (!globalForPrisma.prisma) {
    const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });
  } else {
    prisma = globalForPrisma.prisma;
  }
}

if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
  globalForPrisma.prisma = prisma;
}

export { prisma };
