import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import 'dotenv/config'

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding database...')

  const existingPlan = await prisma.plan.findFirst({
    where: { name: 'Premium Monthly' }
  })

  if (!existingPlan) {
    const plan = await prisma.plan.create({
      data: {
        name: 'Premium Monthly',
        description: 'Access to the Premium Telegram Channel for 30 days',
        price: 10.00,
        currency: 'USD',
        durationDays: 30,
        active: true,
      },
    })
    console.log(`Created plan: ${plan.name} (${plan.id})`)
  } else {
    console.log(`Plan already exists: ${existingPlan.name}`)
  }

  console.log('Seeding finished.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
