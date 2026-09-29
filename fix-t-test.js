/* eslint-disable */
const fs = require("fs");
const path = require("path");

function fixTestFile(file) {
  let content = fs.readFileSync(file, "utf8");
  let changed = false;

  // Replace `test("...", async (t) => {` with `describe("...", () => {`
  // Replace `await t.test("...", () => {` with `test("...", async () => {`

  // This is a rough replace for `t.test`.
  if (content.includes("test(") && content.includes("t.test(")) {
    // Change outer `test("Name", async (t) => {` to `describe("Name", () => {`
    content = content.replace(/test\(\s*(".*?")\s*,\s*async\s*\(\s*t\s*\)\s*=>\s*\{/g, "describe($1, () => {");
    
    // Change inner `await t.test("Name", () => {` to `test("Name", async () => {`
    // And `await t.test("Name", async () => {` to `test("Name", async () => {`
    content = content.replace(/await\s+t\.test\(\s*(".*?")\s*,\s*(async\s*)?\(\s*\)\s*=>\s*\{/g, "test($1, $2() => {");

    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content);
    console.log("Fixed t.test in " + file);
  }
}

const dir = path.join(process.cwd(), "src/tests");
const files = fs.readdirSync(dir);
for (const f of files) {
  if (f.endsWith(".ts")) {
    fixTestFile(path.join(dir, f));
  }
}
