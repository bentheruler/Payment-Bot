/* eslint-disable */
const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, regex, replacement) {
  const fullPath = path.join(process.cwd(), filePath);
  let content = fs.readFileSync(fullPath, 'utf8');
  content = content.replace(regex, replacement);
  fs.writeFileSync(fullPath, content);
}

// 1. users/[id]/page.tsx
replaceInFile('src/app/admin/(dashboard)/users/[id]/page.tsx', /import Link from .next\/link.;/, '');
replaceInFile('src/app/admin/(dashboard)/users/[id]/page.tsx', /const \[user, setUser\] = useState<any>\(null\);/, 'const [user, setUser] = useState<{id: string, telegramId: string, firstName: string, lastName: string, username: string, subscriptions: any[], payments: any[], telegramAccesses: any[]} | null>(null);');
replaceInFile('src/app/admin/(dashboard)/users/[id]/page.tsx', /sub: any/g, 'sub: {id: string, plan: {name: string, price: number, currency: string}, status: string, startsAt: string, expiresAt: string}');
replaceInFile('src/app/admin/(dashboard)/users/[id]/page.tsx', /payment: any/g, 'payment: {id: string, provider: string, amount: number, currency: string, status: string, createdAt: string}');
replaceInFile('src/app/admin/(dashboard)/users/[id]/page.tsx', /access: any/g, 'access: {id: string, chatId: string, status: string, joinedAt: string, revokedAt: string}');

// 2. subscriptions/page.tsx
replaceInFile('src/app/admin/(dashboard)/subscriptions/page.tsx', /useState<any>\(null\);/, 'useState<{data: any[], meta: {page: number, totalPages: number, total: number}} | null>(null);');
replaceInFile('src/app/admin/(dashboard)/subscriptions/page.tsx', /setLoading\(true\);\s*let url/g, 'let url');
replaceInFile('src/app/admin/(dashboard)/subscriptions/page.tsx', /setPage\(p => Math\.max\(1, p - 1\)\)/, '{ setPage(p => Math.max(1, p - 1)); setLoading(true); }');
replaceInFile('src/app/admin/(dashboard)/subscriptions/page.tsx', /setPage\(p => p \+ 1\)/, '{ setPage(p => p + 1); setLoading(true); }');
replaceInFile('src/app/admin/(dashboard)/subscriptions/page.tsx', /setPage\(1\);/, 'setPage(1); setLoading(true);');
replaceInFile('src/app/admin/(dashboard)/subscriptions/page.tsx', /sub: any/g, 'sub: {id: string, userId: string, user: {telegramId: string}, plan: {name: string, price: number, currency: string}, status: string, startsAt: string, expiresAt: string}');

// 3. users/page.tsx
replaceInFile('src/app/admin/(dashboard)/users/page.tsx', /useState<any>\(null\);/, 'useState<{data: any[], meta: {page: number, totalPages: number, total: number}} | null>(null);');
replaceInFile('src/app/admin/(dashboard)/users/page.tsx', /setLoading\(true\);\s*let url/g, 'let url');
replaceInFile('src/app/admin/(dashboard)/users/page.tsx', /setPage\(p => Math\.max\(1, p - 1\)\)/, '{ setPage(p => Math.max(1, p - 1)); setLoading(true); }');
replaceInFile('src/app/admin/(dashboard)/users/page.tsx', /setPage\(p => p \+ 1\)/, '{ setPage(p => p + 1); setLoading(true); }');
replaceInFile('src/app/admin/(dashboard)/users/page.tsx', /setPage\(1\)/, '{ setPage(1); setLoading(true); }');
replaceInFile('src/app/admin/(dashboard)/users/page.tsx', /user: any/g, 'user: {id: string, telegramId: string, firstName: string, lastName: string, createdAt: string}');

// 4. api/admin/payments/route.ts
replaceInFile('src/app/api/admin/payments/route.ts', /providerPayload,/g, '');

// 5. api/webhook/cryptopay/route.ts
replaceInFile('src/app/api/webhook/cryptopay/route.ts', /catch \(error: any\)/g, 'catch (error: unknown)');

// 6. lib/payments/cryptopay.ts
replaceInFile('src/lib/payments/cryptopay.ts', /catch \(error: any\)/g, 'catch (error: unknown)');

// 7. lib/payments/provider.ts
replaceInFile('src/lib/payments/provider.ts', /import \{ Payment \} from "\@prisma\/client";/, '');

// 8. lib/telegram/access-service.ts
replaceInFile('src/lib/telegram/access-service.ts', /catch \(e\)/g, 'catch (error)');
replaceInFile('src/lib/telegram/access-service.ts', /const targetSubscription = await prisma\.subscription\.findFirst/g, 'await prisma.subscription.findFirst');

// 9. tests/auth-flow.test.ts
replaceInFile('src/tests/auth-flow.test.ts', /import \{ test, describe, beforeAll as before, afterAll as after, vi as mock \} from "vitest";/, 'import { test, describe } from "vitest";');

// 10. tests/auth.test.ts
replaceInFile('src/tests/auth.test.ts', /import \{ test, describe, beforeAll as before, afterAll as after, vi as mock \} from "vitest";/, 'import { test, describe } from "vitest";');

// 11. tests/payment.test.ts
replaceInFile('src/tests/payment.test.ts', /import \{ test, describe, beforeAll as before, afterAll as after, vi as mock \} from "vitest";/, 'import { test, describe, beforeAll as before } from "vitest";');
replaceInFile('src/tests/payment.test.ts', /catch \(error: any\)/g, 'catch (error: unknown)');

// 12. tests/telegram-access.test.ts
replaceInFile('src/tests/telegram-access.test.ts', /catch \(error: any\)/g, 'catch (error: unknown)');
replaceInFile('src/tests/telegram-access.test.ts', /const expiredSub = await prisma\.subscription\.create/g, 'await prisma.subscription.create');

// 13. tests/expiration.test.ts
replaceInFile('src/tests/expiration.test.ts', /let fetchMock: unknown;/g, '');
replaceInFile('src/tests/expiration.test.ts', /fetchMock = mock\.spyOn/g, 'mock.spyOn');
replaceInFile('src/tests/expiration.test.ts', /catch \(error: any\)/g, 'catch (error: unknown)');
replaceInFile('src/tests/expiration.test.ts', /const result = await SubscriptionExpirationService/g, 'await SubscriptionExpirationService');
