import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  datasource: {
    url: env("DIRECT_URL") || env("DATABASE_URL"),
  },
  // @ts-expect-error Prisma Config typing doesn't have skills
  skills: {
    agents: ["claude", "cursor", "agents", "devin"],
  },
});


