/* eslint-disable */
const fs = require("fs");
const path = require("path");

const dir = path.join(process.cwd(), "src/tests");
const files = fs.readdirSync(dir);

for (const file of files) {
  if (file.endsWith(".ts")) {
    const fullPath = path.join(dir, file);
    let content = fs.readFileSync(fullPath, "utf8");
    let changed = false;

    if (content.includes('from "node:test"')) {
      content = content.replace(/import test from "node:test";/, 'import { test, describe, beforeAll as before, afterAll as after, vi as mock } from "vitest";');
      content = content.replace(/import { test, describe, before, after, mock } from "node:test";/, 'import { test, describe, beforeAll as before, afterAll as after, vi as mock } from "vitest";');
      content = content.replace(/import { test, describe, mock, before, after } from "node:test";/, 'import { test, describe, vi as mock, beforeAll as before, afterAll as after } from "vitest";');
      content = content.replace(/import { test, describe } from "node:test";/, 'import { test, describe } from "vitest";');
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(fullPath, content);
      console.log("Migrated " + file);
    }
  }
}
