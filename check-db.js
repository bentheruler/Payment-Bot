const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.$connect().then(() => {
  console.log('Connected');
  process.exit(0);
}).catch(e => {
  console.error('Failed', e);
  process.exit(1);
});
