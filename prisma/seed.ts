import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const passwordHash = await bcrypt.hash('akkar2026', 12)

  // Create admin user (Callum)
  const admin = await prisma.user.upsert({
    where: { email: 'callum@akkar.com' },
    update: {},
    create: {
      email: 'callum@akkar.com',
      name: 'Callum Akkar',
      passwordHash,
      role: 'ADMIN',
      jobTitle: 'Director',
    },
  })

  // Create a manager
  const manager = await prisma.user.upsert({
    where: { email: 'manager@akkar.com' },
    update: {},
    create: {
      email: 'manager@akkar.com',
      name: 'Sarah Johnson',
      passwordHash,
      role: 'MANAGER',
      managerId: admin.id,
      jobTitle: 'Team Lead',
    },
  })

  // Create reps
  const rep1 = await prisma.user.upsert({
    where: { email: 'mike@akkar.com' },
    update: {},
    create: {
      email: 'mike@akkar.com',
      name: 'Mike Chen',
      passwordHash,
      role: 'REP',
      managerId: manager.id,
      jobTitle: 'Senior Consultant',
    },
  })

  const rep2 = await prisma.user.upsert({
    where: { email: 'emily@akkar.com' },
    update: {},
    create: {
      email: 'emily@akkar.com',
      name: 'Emily Davis',
      passwordHash,
      role: 'REP',
      managerId: manager.id,
      jobTitle: 'Consultant',
    },
  })

  console.log('  Created users')

  // Create a commission plan
  const plan = await prisma.commissionPlan.create({
    data: {
      name: 'Standard Consultant Plan - 2026',
      description: 'Standard commission plan for consultants',
      fiscalYear: '2026',
      currency: 'GBP',
      components: {
        create: [
          {
            name: 'Permanent Placements',
            type: 'PLACEMENT_PERM',
            rate: 0.10,
            isPercentage: true,
          },
          {
            name: 'Contract Placements',
            type: 'PLACEMENT_CONTRACT',
            rate: 0.08,
            isPercentage: true,
          },
          {
            name: 'Timesheets',
            type: 'TIMESHEET',
            rate: 0.05,
            isPercentage: true,
          },
          {
            name: 'Performance Kicker',
            type: 'KICKER',
            rate: 0.02,
            isPercentage: true,
            kickerThreshold: 100000,
          },
        ],
      },
    },
    include: { components: true },
  })

  // Create a manager override plan
  const overridePlan = await prisma.commissionPlan.create({
    data: {
      name: 'Manager Override Plan - 2026',
      description: 'Override commission for managers on team deals',
      fiscalYear: '2026',
      currency: 'GBP',
      components: {
        create: [
          {
            name: 'Team Override',
            type: 'OVERRIDE',
            rate: 0.03,
            isPercentage: true,
          },
        ],
      },
    },
    include: { components: true },
  })

  console.log('  Created commission plans')

  // Assign plans to users
  const startDate = new Date('2026-01-01')

  // Assign consultant plan to reps
  for (const rep of [rep1, rep2]) {
    await prisma.userPlanAssignment.create({
      data: {
        userId: rep.id,
        commissionPlanId: plan.id,
        startDate,
        components: {
          connect: plan.components.map(c => ({ id: c.id })),
        },
      },
    })
  }

  // Assign override plan to manager
  await prisma.userPlanAssignment.create({
    data: {
      userId: manager.id,
      commissionPlanId: overridePlan.id,
      startDate,
      components: {
        connect: overridePlan.components.map(c => ({ id: c.id })),
      },
    },
  })

  // Also assign consultant plan to manager for their own deals
  await prisma.userPlanAssignment.create({
    data: {
      userId: manager.id,
      commissionPlanId: plan.id,
      startDate,
      components: {
        connect: plan.components.map(c => ({ id: c.id })),
      },
    },
  })

  console.log('  Assigned plans')

  // Create targets for current year
  const year = 2026
  for (const rep of [manager, rep1, rep2]) {
    for (let month = 1; month <= 12; month++) {
      const period = `${year}-${String(month).padStart(2, '0')}`
      await prisma.target.upsert({
        where: { userId_period: { userId: rep.id, period } },
        update: {},
        create: {
          userId: rep.id,
          period,
          nfiTargetGBP: rep.id === rep1.id ? 50000 : rep.id === rep2.id ? 40000 : 60000,
          placementTargetCount: 3,
        },
      })
    }
  }

  console.log('  Created targets')

  // Create sample SF accounts and placements for testing
  const account1 = await prisma.sFAccount.create({
    data: { salesforceId: 'SF_ACC_001', name: 'TechCorp Ltd' },
  })

  const account2 = await prisma.sFAccount.create({
    data: { salesforceId: 'SF_ACC_002', name: 'Mobileye' },
  })

  // Create sample placements
  const placements = [
    { name: 'PL-001 Senior Developer', accountId: account1.id, ownerUserId: rep1.id, nfiValue: 25000, placementType: 'PERM' as const, invoicedDate: new Date('2026-02-10'), paidToAkkar: true },
    { name: 'PL-002 Project Manager', accountId: account1.id, ownerUserId: rep1.id, nfiValue: 30000, placementType: 'PERM' as const, invoicedDate: new Date('2026-02-15'), paidToAkkar: true },
    { name: 'PL-003 Data Analyst', accountId: account2.id, ownerUserId: rep2.id, nfiValue: 18000, placementType: 'PERM' as const, invoicedDate: new Date('2026-02-08'), paidToAkkar: true },
    { name: 'PL-004 Contract Developer', accountId: account1.id, ownerUserId: rep2.id, nfiValue: 15000, placementType: 'CONTRACT' as const, invoicedDate: new Date('2026-01-20'), paidToAkkar: true },
    { name: 'PL-005 QA Engineer', accountId: account2.id, ownerUserId: manager.id, nfiValue: 22000, placementType: 'PERM' as const, invoicedDate: new Date('2026-02-18'), paidToAkkar: true },
  ]

  for (const pl of placements) {
    await prisma.placement.create({
      data: {
        salesforceId: `SF_${pl.name.replace(/\s/g, '_')}`,
        name: pl.name,
        accountId: pl.accountId,
        ownerSalesforceUserId: 'SF_USER_PLACEHOLDER',
        ownerUserId: pl.ownerUserId,
        nfiValue: pl.nfiValue,
        placedDate: new Date(pl.invoicedDate.getTime() - 30 * 24 * 60 * 60 * 1000),
        invoicedDate: pl.invoicedDate,
        paidToAkkar: pl.paidToAkkar,
        placementType: pl.placementType,
      },
    })
  }

  // Create sample timesheets
  const timesheets = [
    { name: 'TS-001 Contract Dev Week 1', accountId: account1.id, ownerUserId: rep2.id, grossValue: 3500, nfiValue: 1200, weekEnding: new Date('2026-02-07') },
    { name: 'TS-002 Contract Dev Week 2', accountId: account1.id, ownerUserId: rep2.id, grossValue: 3500, nfiValue: 1200, weekEnding: new Date('2026-02-14') },
    { name: 'TS-003 Contract Dev Week 3', accountId: account1.id, ownerUserId: rep2.id, grossValue: 3500, nfiValue: 1200, weekEnding: new Date('2026-02-21') },
  ]

  for (const ts of timesheets) {
    await prisma.timesheet.create({
      data: {
        salesforceId: `SF_${ts.name.replace(/\s/g, '_')}`,
        name: ts.name,
        accountId: ts.accountId,
        ownerSalesforceUserId: 'SF_USER_PLACEHOLDER',
        ownerUserId: ts.ownerUserId,
        weekEnding: ts.weekEnding,
        grossValue: ts.grossValue,
        nfiValue: ts.nfiValue,
        paidToAkkar: true,
      },
    })
  }

  console.log('  Created sample placements and timesheets')

  console.log('')
  console.log('Seed complete!')
  console.log('')
  console.log('Login credentials (password: akkar2026):')
  console.log('  Admin:   callum@akkar.com')
  console.log('  Manager: manager@akkar.com')
  console.log('  Reps:    mike@akkar.com')
  console.log('           emily@akkar.com')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
