/* eslint-disable */
const fs = require("fs");
const path = require("path");

function replaceInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, "utf8");
  let changed = false;
  for (const [search, replace] of replacements) {
    if (content.includes(search)) {
      content = content.replaceAll(search, replace);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log("Fixed " + filePath);
  }
}

// 1. Fix "const where: any = {};"
const apisWithWhereAny = [
  "src/app/api/admin/access/route.ts",
  "src/app/api/admin/audit-logs/route.ts",
  "src/app/api/admin/payments/route.ts",
  "src/app/api/admin/subscriptions/route.ts",
];
for (const file of apisWithWhereAny) {
  replaceInFile(path.join(process.cwd(), file), [
    ["const where: any = {};", "const where: Record<string, unknown> = {};"]
  ]);
}

// 2. Fix other specific `any` usages
replaceInFile(path.join(process.cwd(), "src/app/api/webhook/cryptopay/route.ts"), [
  ["const body: any = await req.json();", "const body: unknown = await req.json();"],
  ["(req as any).rawBody", "req.text()"], // Assuming this was an issue
  ["let body: any;", "let body: unknown;"]
]);
replaceInFile(path.join(process.cwd(), "src/lib/payments/cryptopay.ts"), [
  ["function verifySignature(signature: string, payload: any, secret: string)", "function verifySignature(signature: string, payload: unknown, secret: string)"],
  ["(payload as any)", "(payload as Record<string, unknown>)"]
]);

// 3. Fix tests with `any`
const testFiles = fs.readdirSync(path.join(process.cwd(), "src/tests"));
for (const file of testFiles) {
  if (file.endsWith(".ts")) {
    const filePath = path.join(process.cwd(), "src/tests", file);
    replaceInFile(filePath, [
      [": any", ": unknown"],
      ["as any", "as unknown"],
    ]);
  }
}

// 4. Fix React hook dependencies in users page
replaceInFile(path.join(process.cwd(), "src/app/admin/(dashboard)/users/page.tsx"), [
  ["useEffect(() => {", "useEffect(() => {"],
  ["fetchUsers(page, search);", "fetchUsers(page, search);"],
  ["}, [page]); // Re-fetch on page change", "}, [page, search]);"]
]);

// 5. Fix unused vars (warnings are fine for now, but `error` unused is easy)
replaceInFile(path.join(process.cwd(), "src/app/api/telegram/access/route.ts"), [
  ["catch (err: any)", "catch (err: unknown)"],
  ["catch (error) {", "catch {"] // if error is unused
]);
