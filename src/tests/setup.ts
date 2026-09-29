import { beforeAll, afterAll } from "vitest";
import { pgliteClient, prisma } from "../lib/prisma";
import fs from "fs";
import path from "path";

interface MockPGlite {
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

beforeAll(async () => {
  if (pgliteClient) {
    const schemaSql = fs.readFileSync(path.join(__dirname, "../../prisma/schema.sql"), "utf8").replace(/^\uFEFF/, '');
    await (pgliteClient as unknown as MockPGlite).exec(schemaSql);
  }
});

afterAll(async () => {
  if (prisma) await prisma.$disconnect();
  if (pgliteClient) {
    await (pgliteClient as unknown as MockPGlite).close();
  }
});
