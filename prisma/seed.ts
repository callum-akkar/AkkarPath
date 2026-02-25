import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create admin user
  const adminHash = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@akkar.com' },
    update: {},
    create: {
      email: 'admin@akkar.com',
      name: 'Callum (Admin)',
      passwordHash: adminHash,
      role: 'admin',
    },
  })

  // Create commission plans with OTE, base salary, and quota
  const flatPlan = await prisma.commissionPlan.create({
    data: {
      name: 'Standard 10%',
      description: 'Flat 10% commission on all closed-won deals',
      planType: 'flat_rate',
      ote: 120000,
      baseSalary: 60000,
      quotaAmount: 600000,
      payFrequency: 'monthly',
      tiers: {
        create: [{ minAmount: 0, maxAmount: null, rate: 0.10, orderIndex: 0 }],
      },
    },
  })

  const tieredPlan = await prisma.commissionPlan.create({
    data: {
      name: 'Tiered Growth',
      description: 'Higher rates for larger deals - rewards bigger wins',
      planType: 'tiered',
      ote: 150000,
      baseSalary: 75000,
      quotaAmount: 750000,
      payFrequency: 'monthly',
      tiers: {
        create: [
          { minAmount: 0, maxAmount: 10000, rate: 0.08, orderIndex: 0 },
          { minAmount: 10000, maxAmount: 50000, rate: 0.10, orderIndex: 1 },
          { minAmount: 50000, maxAmount: null, rate: 0.12, orderIndex: 2 },
        ],
      },
    },
  })

  const acceleratorPlan = await prisma.commissionPlan.create({
    data: {
      name: 'Accelerator',
      description: 'Higher rates as you close more revenue - rewards overachievers',
      planType: 'accelerator',
      ote: 180000,
      baseSalary: 80000,
      quotaAmount: 1000000,
      payFrequency: 'monthly',
      hasRamp: true,
      tiers: {
        create: [
          { minAmount: 0, maxAmount: 250000, rate: 0.08, orderIndex: 0 },
          { minAmount: 250000, maxAmount: 750000, rate: 0.10, orderIndex: 1 },
          { minAmount: 750000, maxAmount: null, rate: 0.15, orderIndex: 2 },
        ],
      },
      rampSchedule: {
        create: [
          { month: 1, quotaPct: 0.25, commissionPct: 1.0 },
          { month: 2, quotaPct: 0.50, commissionPct: 1.0 },
          { month: 3, quotaPct: 0.75, commissionPct: 1.0 },
        ],
      },
    },
  })

  // Assign admin to flat plan
  await prisma.user.update({
    where: { id: admin.id },
    data: { planId: flatPlan.id },
  })

  // Create sales reps
  const repHash = await bcrypt.hash('rep123', 10)

  const rep1 = await prisma.user.create({
    data: {
      email: 'sarah@akkar.com',
      name: 'Sarah Johnson',
      passwordHash: repHash,
      role: 'rep',
      planId: tieredPlan.id,
    },
  })

  const rep2 = await prisma.user.create({
    data: {
      email: 'mike@akkar.com',
      name: 'Mike Chen',
      passwordHash: repHash,
      role: 'rep',
      planId: acceleratorPlan.id,
    },
  })

  const rep3 = await prisma.user.create({
    data: {
      email: 'emily@akkar.com',
      name: 'Emily Davis',
      passwordHash: repHash,
      role: 'rep',
      planId: flatPlan.id,
    },
  })

  // Set quota targets for all reps for current year
  const now = new Date()
  const year = now.getFullYear()
  const reps = [
    { id: rep1.id, monthlyQuota: 62500 },   // 750k / 12
    { id: rep2.id, monthlyQuota: 83333 },   // 1M / 12
    { id: rep3.id, monthlyQuota: 50000 },   // 600k / 12
  ]

  for (const rep of reps) {
    for (let month = 1; month <= 12; month++) {
      const period = `${year}-${String(month).padStart(2, '0')}`
      await prisma.quotaTarget.create({
        data: {
          repId: rep.id,
          period,
          periodType: 'monthly',
          targetAmount: rep.monthlyQuota,
        },
      })
    }
  }

  console.log('  Created quota targets for all reps')

  // Create sample deals
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 15)
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15)
  const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 15)

  const deals = [
    { name: 'Acme Corp - Enterprise', amount: 75000, status: 'closed_won', closeDate: lastMonth, repId: rep1.id },
    { name: 'TechStart - Growth Plan', amount: 25000, status: 'closed_won', closeDate: lastMonth, repId: rep1.id },
    { name: 'Global Retail - Annual', amount: 120000, status: 'closed_won', closeDate: twoMonthsAgo, repId: rep2.id },
    { name: 'StartupXYZ - Starter', amount: 8000, status: 'closed_won', closeDate: lastMonth, repId: rep2.id },
    { name: 'MegaCorp - Multi-year', amount: 200000, status: 'open', closeDate: null, repId: rep1.id },
    { name: 'DataFlow Inc', amount: 45000, status: 'closed_won', closeDate: thisMonth, repId: rep3.id },
    { name: 'CloudNine Systems', amount: 32000, status: 'closed_won', closeDate: twoMonthsAgo, repId: rep3.id },
    { name: 'FinTech Solutions', amount: 68000, status: 'closed_won', closeDate: lastMonth, repId: rep3.id },
    { name: 'HealthPlus', amount: 15000, status: 'closed_lost', closeDate: lastMonth, repId: rep2.id },
    { name: 'EduTech Group', amount: 52000, status: 'open', closeDate: null, repId: rep2.id },
    { name: 'RetailMax', amount: 38000, status: 'closed_won', closeDate: thisMonth, repId: rep1.id },
    { name: 'LogiTrans', amount: 90000, status: 'open', closeDate: null, repId: rep3.id },
  ]

  for (const deal of deals) {
    await prisma.deal.create({ data: deal })
  }

  // Generate commissions for closed-won deals
  const closedDeals = await prisma.deal.findMany({
    where: { status: 'closed_won' },
    include: {
      rep: { include: { plan: { include: { tiers: true } } } },
    },
  })

  for (const deal of closedDeals) {
    if (!deal.rep.plan) continue

    const plan = deal.rep.plan
    const tiers = plan.tiers.sort((a, b) => a.orderIndex - b.orderIndex)
    let commissionAmount = 0

    if (plan.planType === 'flat_rate') {
      commissionAmount = deal.amount * (tiers[0]?.rate || 0)
    } else if (plan.planType === 'tiered') {
      let remaining = deal.amount
      for (const tier of tiers) {
        if (remaining <= 0) break
        const tierMax = tier.maxAmount ?? Infinity
        const tierRange = tierMax - tier.minAmount
        const amountInTier = Math.min(remaining, tierRange)
        commissionAmount += amountInTier * tier.rate
        remaining -= amountInTier
      }
    } else if (plan.planType === 'accelerator') {
      let rate = tiers[0]?.rate || 0
      for (const tier of tiers) {
        if (deal.amount >= tier.minAmount) rate = tier.rate
      }
      commissionAmount = deal.amount * rate
    }

    const period = deal.closeDate
      ? `${deal.closeDate.getFullYear()}-${String(deal.closeDate.getMonth() + 1).padStart(2, '0')}`
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    await prisma.commission.create({
      data: {
        amount: commissionAmount,
        status: Math.random() > 0.5 ? 'paid' : 'pending',
        period,
        dealId: deal.id,
        repId: deal.repId,
        planId: plan.id,
      },
    })
  }

  console.log('Seed complete!')
  console.log('')
  console.log('Login credentials:')
  console.log('  Admin: admin@akkar.com / admin123')
  console.log('  Reps:  sarah@akkar.com / rep123')
  console.log('         mike@akkar.com  / rep123')
  console.log('         emily@akkar.com / rep123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
