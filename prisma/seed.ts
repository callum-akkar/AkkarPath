import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const passwordHash = await bcrypt.hash('akkar2026', 12)

  // ─── Users ──────────────────────────────────────────────────────────

  const admin = await prisma.user.upsert({
    where: { email: 'callum@akkar.com' },
    update: {},
    create: {
      email: 'callum@akkar.com',
      name: 'Callum Akkar',
      passwordHash,
      role: 'ADMIN',
      jobTitle: 'Director',
      department: 'Leadership',
      salary: 80000,
      startDate: new Date('2020-01-06'),
    },
  })

  const manager = await prisma.user.upsert({
    where: { email: 'manager@akkar.com' },
    update: {},
    create: {
      email: 'manager@akkar.com',
      name: 'Sarah Johnson',
      passwordHash,
      role: 'MANAGER',
      managerId: admin.id,
      jobTitle: 'Recruitment Manager',
      department: 'Recruitment',
      salary: 55000,
      startDate: new Date('2022-03-14'),
    },
  })

  const rep1 = await prisma.user.upsert({
    where: { email: 'mike@akkar.com' },
    update: {},
    create: {
      email: 'mike@akkar.com',
      name: 'Mike Chen',
      passwordHash,
      role: 'REP',
      managerId: manager.id,
      jobTitle: '360 Recruiter',
      department: 'Recruitment',
      salary: 35000,
      startDate: new Date('2023-09-04'),
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
      jobTitle: 'Delivery Recruiter',
      department: 'Recruitment',
      salary: 30000,
      startDate: new Date('2024-06-10'),
    },
  })

  console.log('  Created users')

  // ─── Plan 1: 360 Recruiter Plan ────────────────────────────────────

  const plan360 = await prisma.commissionPlan.create({
    data: {
      name: '360 Recruiter Plan — FY 26/27',
      description: 'Full 360 recruiter commission plan with tiered perm, contract, and passover',
      fiscalYear: 'FY26/27',
      currency: 'GBP',
      components: {
        create: [
          {
            name: 'Permanent Placements Tier 1',
            type: 'PLACEMENT_PERM',
            rate: 0.05,
            isPercentage: true,
            minValue: 0,
            maxValue: 10000,
            tier: 1,
          },
          {
            name: 'Permanent Placements Tier 2',
            type: 'PLACEMENT_PERM',
            rate: 0.15,
            isPercentage: true,
            minValue: 10000,
            maxValue: null,
            tier: 2,
          },
          {
            name: 'Permanent Placements Over FQ Target',
            type: 'PLACEMENT_PERM',
            rate: 0.20,
            isPercentage: true,
            tier: 3,
          },
          {
            name: 'Permanent Placements 150% of FQ Target',
            type: 'PLACEMENT_PERM',
            rate: 0.30,
            isPercentage: true,
            tier: 4,
          },
          {
            name: 'Permanent Placements 200% of FQ Target',
            type: 'PLACEMENT_PERM',
            rate: 0.40,
            isPercentage: true,
            tier: 5,
          },
          {
            name: 'Contract Tier 1 (£0–300/day)',
            type: 'PLACEMENT_CONTRACT',
            rate: 0.10,
            isPercentage: true,
            minValue: 0,
            maxValue: 300,
            tier: 1,
          },
          {
            name: 'Contract Tier 2 (£301–500/day)',
            type: 'PLACEMENT_CONTRACT',
            rate: 0.15,
            isPercentage: true,
            minValue: 301,
            maxValue: 500,
            tier: 2,
          },
          {
            name: 'Contract Tier 3 (£501+/day)',
            type: 'PLACEMENT_CONTRACT',
            rate: 0.20,
            isPercentage: true,
            minValue: 501,
            maxValue: null,
            tier: 3,
          },
          {
            name: 'Delivery Handoff Passover',
            type: 'OVERRIDE',
            rate: 0.03,
            isPercentage: true,
          },
        ],
      },
    },
    include: { components: true },
  })

  console.log('  Created Plan 1: 360 Recruiter Plan')

  // ─── Plan 2: Delivery Recruiter Plan ───────────────────────────────

  const planDelivery = await prisma.commissionPlan.create({
    data: {
      name: 'Delivery Recruiter Plan — FY 26/27',
      description: 'Delivery recruiter commission plan with tiered perm and contract',
      fiscalYear: 'FY26/27',
      currency: 'GBP',
      components: {
        create: [
          {
            name: 'Permanent Placements Tier 1',
            type: 'PLACEMENT_PERM',
            rate: 0.05,
            isPercentage: true,
            minValue: 0,
            maxValue: 10000,
            tier: 1,
          },
          {
            name: 'Permanent Placements Tier 2',
            type: 'PLACEMENT_PERM',
            rate: 0.10,
            isPercentage: true,
            minValue: 10000,
            maxValue: null,
            tier: 2,
          },
          {
            name: 'Permanent Placements Over FQ Target',
            type: 'PLACEMENT_PERM',
            rate: 0.15,
            isPercentage: true,
            tier: 3,
          },
          {
            name: 'Contract Tier 1 (£0–300/day)',
            type: 'PLACEMENT_CONTRACT',
            rate: 0.10,
            isPercentage: true,
            minValue: 0,
            maxValue: 300,
            tier: 1,
          },
          {
            name: 'Contract Tier 2 (£301–500/day)',
            type: 'PLACEMENT_CONTRACT',
            rate: 0.15,
            isPercentage: true,
            minValue: 301,
            maxValue: 500,
            tier: 2,
          },
          {
            name: 'Contract Tier 3 (£501+/day)',
            type: 'PLACEMENT_CONTRACT',
            rate: 0.20,
            isPercentage: true,
            minValue: 501,
            maxValue: null,
            tier: 3,
          },
        ],
      },
    },
    include: { components: true },
  })

  console.log('  Created Plan 2: Delivery Recruiter Plan')

  // ─── Plan 3: BD Passover Plan ──────────────────────────────────────

  await prisma.commissionPlan.create({
    data: {
      name: 'BD Passover Plan — FY 26/27',
      description: 'BD passover commission for handed-off deals',
      fiscalYear: 'FY26/27',
      currency: 'GBP',
      components: {
        create: [
          {
            name: 'BD Passover Commission',
            type: 'PLACEMENT_PERM',
            rate: 0.03,
            isPercentage: true,
            minValue: 0,
            maxValue: 10000,
            tier: 1,
          },
        ],
      },
    },
  })

  console.log('  Created Plan 3: BD Passover Plan')

  // ─── Plan 4: Account Manager Plan ─────────────────────────────────

  await prisma.commissionPlan.create({
    data: {
      name: 'Account Manager Plan — FY 26/27',
      description: 'Account manager commission with base, kickers, and client bonuses',
      fiscalYear: 'FY26/27',
      currency: 'GBP',
      components: {
        create: [
          {
            name: 'Base: 1% of Account Revenue (Guaranteed)',
            type: 'TIMESHEET',
            rate: 0.01,
            isPercentage: true,
          },
          {
            name: '100% of Target — Backdated',
            type: 'KICKER',
            rate: 0.015,
            isPercentage: true,
            kickerThreshold: 50000,
          },
          {
            name: 'Over Target Kicker — Not Backdated',
            type: 'KICKER',
            rate: 0.03,
            isPercentage: true,
          },
          {
            name: 'Client >100% NFI Target Bonus (£500 per client)',
            type: 'BONUS_FLAT',
            rate: 500,
            isPercentage: false,
          },
          {
            name: 'New Client Bonus (£1,000)',
            type: 'BONUS_FLAT',
            rate: 1000,
            isPercentage: false,
          },
        ],
      },
    },
  })

  console.log('  Created Plan 4: Account Manager Plan')

  // ─── Plan 5: Recruitment Manager Plan ──────────────────────────────

  const planManager = await prisma.commissionPlan.create({
    data: {
      name: 'Recruitment Manager Plan — FY 26/27',
      description: 'Manager override commission with base, target kickers',
      fiscalYear: 'FY26/27',
      currency: 'GBP',
      components: {
        create: [
          {
            name: 'Base: 1% of Team Revenue (Guaranteed)',
            type: 'OVERRIDE',
            rate: 0.01,
            isPercentage: true,
          },
          {
            name: '100% of Team Target — Backdated',
            type: 'KICKER',
            rate: 0.015,
            isPercentage: true,
            kickerThreshold: 150000,
          },
          {
            name: 'Over Team Target Kicker — Not Backdated',
            type: 'KICKER',
            rate: 0.03,
            isPercentage: true,
          },
        ],
      },
    },
    include: { components: true },
  })

  console.log('  Created Plan 5: Recruitment Manager Plan')

  // ─── Plan 6: Client Milestone Bonuses ──────────────────────────────

  const planClientMilestones = await prisma.commissionPlan.create({
    data: {
      name: 'Client Milestone Bonuses — FY 26/27',
      description: 'Client milestone bonuses for billing thresholds',
      fiscalYear: 'FY26/27',
      currency: 'GBP',
      components: {
        create: [
          {
            name: 'New Client Bonus',
            type: 'BONUS_FLAT',
            rate: 1000,
            isPercentage: false,
          },
          {
            name: 'Client Passover Bonus (£100k billed)',
            type: 'BONUS_FLAT',
            rate: 2000,
            isPercentage: false,
          },
          {
            name: 'Bronze Client Bonus (£200k billed)',
            type: 'BONUS_FLAT',
            rate: 2000,
            isPercentage: false,
          },
          {
            name: 'Silver Client Bonus (£500k billed)',
            type: 'BONUS_FLAT',
            rate: 2000,
            isPercentage: false,
          },
          {
            name: 'Gold Client Bonus (£1m billed)',
            type: 'BONUS_FLAT',
            rate: 5000,
            isPercentage: false,
          },
          {
            name: 'Platinum Client Bonus (£2m billed)',
            type: 'BONUS_FLAT',
            rate: 10000,
            isPercentage: false,
          },
        ],
      },
    },
    include: { components: true },
  })

  console.log('  Created Plan 6: Client Milestone Bonuses')

  // ─── Plan 7: Ops Bonus Plan ────────────────────────────────────────

  await prisma.commissionPlan.create({
    data: {
      name: 'Ops Bonus Plan — FY 26/27',
      description: 'Operations bonus plan - personal and company performance',
      fiscalYear: 'FY26/27',
      currency: 'GBP',
      components: {
        create: [
          {
            name: 'Personal Performance Bonus (5% of salary)',
            type: 'BONUS_FLAT',
            rate: 0.05,
            isPercentage: true,
          },
          {
            name: 'Company Performance Bonus (5% of salary)',
            type: 'BONUS_FLAT',
            rate: 0.05,
            isPercentage: true,
          },
        ],
      },
    },
  })

  console.log('  Created Plan 7: Ops Bonus Plan')

  // ─── Plan Assignments ──────────────────────────────────────────────

  const startDate = new Date('2026-04-01') // FY26/27 starts April 2026

  // mike@akkar.com → 360 Recruiter Plan + Client Milestone Bonuses
  await prisma.userPlanAssignment.create({
    data: {
      userId: rep1.id,
      commissionPlanId: plan360.id,
      startDate,
      components: { connect: plan360.components.map(c => ({ id: c.id })) },
    },
  })
  await prisma.userPlanAssignment.create({
    data: {
      userId: rep1.id,
      commissionPlanId: planClientMilestones.id,
      startDate,
      components: { connect: planClientMilestones.components.map(c => ({ id: c.id })) },
    },
  })

  // emily@akkar.com → Delivery Recruiter Plan + Client Milestone Bonuses
  await prisma.userPlanAssignment.create({
    data: {
      userId: rep2.id,
      commissionPlanId: planDelivery.id,
      startDate,
      components: { connect: planDelivery.components.map(c => ({ id: c.id })) },
    },
  })
  await prisma.userPlanAssignment.create({
    data: {
      userId: rep2.id,
      commissionPlanId: planClientMilestones.id,
      startDate,
      components: { connect: planClientMilestones.components.map(c => ({ id: c.id })) },
    },
  })

  // manager@akkar.com → Recruitment Manager Plan + Client Milestone Bonuses
  await prisma.userPlanAssignment.create({
    data: {
      userId: manager.id,
      commissionPlanId: planManager.id,
      startDate,
      components: { connect: planManager.components.map(c => ({ id: c.id })) },
    },
  })
  await prisma.userPlanAssignment.create({
    data: {
      userId: manager.id,
      commissionPlanId: planClientMilestones.id,
      startDate,
      components: { connect: planClientMilestones.components.map(c => ({ id: c.id })) },
    },
  })

  console.log('  Assigned plans to users')

  // ─── Quarterly Targets (FY26/27) ──────────────────────────────────

  const fyQuarters = ['FY26/27-Q1', 'FY26/27-Q2', 'FY26/27-Q3', 'FY26/27-Q4']

  // mike@akkar.com: £50,000 per quarter
  for (const q of fyQuarters) {
    await prisma.target.upsert({
      where: { userId_period: { userId: rep1.id, period: q } },
      update: { nfiTargetGBP: 50000 },
      create: {
        userId: rep1.id,
        period: q,
        nfiTargetGBP: 50000,
        placementTargetCount: 3,
      },
    })
  }

  // emily@akkar.com: £40,000 per quarter
  for (const q of fyQuarters) {
    await prisma.target.upsert({
      where: { userId_period: { userId: rep2.id, period: q } },
      update: { nfiTargetGBP: 40000 },
      create: {
        userId: rep2.id,
        period: q,
        nfiTargetGBP: 40000,
        placementTargetCount: 3,
      },
    })
  }

  // manager@akkar.com: £150,000 per quarter (team target)
  for (const q of fyQuarters) {
    await prisma.target.upsert({
      where: { userId_period: { userId: manager.id, period: q } },
      update: { nfiTargetGBP: 150000 },
      create: {
        userId: manager.id,
        period: q,
        nfiTargetGBP: 150000,
        placementTargetCount: 9,
      },
    })
  }

  console.log('  Created quarterly targets')

  // ─── Sample SF Accounts and Placements ─────────────────────────────

  try {
    const account1 = await prisma.sFAccount.upsert({
      where: { salesforceId: 'SF_ACC_001' },
      update: {},
      create: { salesforceId: 'SF_ACC_001', name: 'TechCorp Ltd' },
    })

    const account2 = await prisma.sFAccount.upsert({
      where: { salesforceId: 'SF_ACC_002' },
      update: {},
      create: { salesforceId: 'SF_ACC_002', name: 'Mobileye' },
    })

    // Sample placements (dates in FY26/27 Q1: Apr-Jun 2026)
    const placements = [
      { sfId: 'SF_PL-001_Senior_Developer', name: 'PL-001 Senior Developer', accountId: account1.id, ownerUserId: rep1.id, nfiValue: 25000, placementType: 'PERM' as const, invoicedDate: new Date('2026-05-10'), paidToAkkar: true },
      { sfId: 'SF_PL-002_Project_Manager', name: 'PL-002 Project Manager', accountId: account1.id, ownerUserId: rep1.id, nfiValue: 30000, placementType: 'PERM' as const, invoicedDate: new Date('2026-05-15'), paidToAkkar: true },
      { sfId: 'SF_PL-003_Data_Analyst', name: 'PL-003 Data Analyst', accountId: account2.id, ownerUserId: rep2.id, nfiValue: 18000, placementType: 'PERM' as const, invoicedDate: new Date('2026-04-08'), paidToAkkar: true },
      { sfId: 'SF_PL-004_Contract_Developer', name: 'PL-004 Contract Developer', accountId: account1.id, ownerUserId: rep2.id, nfiValue: 15000, placementType: 'CONTRACT' as const, invoicedDate: new Date('2026-04-20'), paidToAkkar: true },
      { sfId: 'SF_PL-005_QA_Engineer', name: 'PL-005 QA Engineer', accountId: account2.id, ownerUserId: manager.id, nfiValue: 22000, placementType: 'PERM' as const, invoicedDate: new Date('2026-05-18'), paidToAkkar: true },
    ]

    for (const pl of placements) {
      await prisma.placement.upsert({
        where: { salesforceId: pl.sfId },
        update: {},
        create: {
          salesforceId: pl.sfId,
          name: pl.name,
          accountId: pl.accountId,
          ownerSalesforceUserId: 'SF_USER_PLACEHOLDER',
          ownerUserId: pl.ownerUserId,
          nfiValue: pl.nfiValue,
          placedDate: new Date(pl.invoicedDate.getTime() - 30 * 24 * 60 * 60 * 1000),
          invoicedDate: pl.invoicedDate,
          paidToAkkar: pl.paidToAkkar,
          placementType: pl.placementType,
          candidateName: pl.name.split(' ').slice(1).join(' '),
        },
      })
    }

    // Sample timesheets (dates in FY26/27 Q1)
    const timesheets = [
      { sfId: 'SF_TS-001_Contract_Dev_Week_1', name: 'TS-001 Contract Dev Week 1', accountId: account1.id, ownerUserId: rep2.id, grossValue: 3500, nfiValue: 1200, weekEnding: new Date('2026-04-07') },
      { sfId: 'SF_TS-002_Contract_Dev_Week_2', name: 'TS-002 Contract Dev Week 2', accountId: account1.id, ownerUserId: rep2.id, grossValue: 3500, nfiValue: 1200, weekEnding: new Date('2026-04-14') },
      { sfId: 'SF_TS-003_Contract_Dev_Week_3', name: 'TS-003 Contract Dev Week 3', accountId: account1.id, ownerUserId: rep2.id, grossValue: 3500, nfiValue: 1200, weekEnding: new Date('2026-04-21') },
    ]

    for (const ts of timesheets) {
      await prisma.timesheet.upsert({
        where: { salesforceId: ts.sfId },
        update: {},
        create: {
          salesforceId: ts.sfId,
          name: ts.name,
          accountId: ts.accountId,
          ownerSalesforceUserId: 'SF_USER_PLACEHOLDER',
          ownerUserId: ts.ownerUserId,
          weekEnding: ts.weekEnding,
          grossValue: ts.grossValue,
          nfiValue: ts.nfiValue,
          paidToAkkar: true,
          candidateName: 'Contract Developer',
        },
      })
    }

    console.log('  Created sample placements and timesheets')

    // ─── Team Targets (FY26/27) ───────────────────────────────────────

    // Sarah Johnson (manager) team target: £150,000 per quarter
    for (const q of fyQuarters) {
      await prisma.teamTarget.upsert({
        where: { managerId_period: { managerId: manager.id, period: q } },
        update: { nfiTargetGBP: 150000 },
        create: {
          managerId: manager.id,
          period: q,
          nfiTargetGBP: 150000,
          placementTarget: 9,
        },
      })
    }

    // Callum (admin) team target: £300,000 per quarter (whole company)
    for (const q of fyQuarters) {
      await prisma.teamTarget.upsert({
        where: { managerId_period: { managerId: admin.id, period: q } },
        update: { nfiTargetGBP: 300000 },
        create: {
          managerId: admin.id,
          period: q,
          nfiTargetGBP: 300000,
          placementTarget: 18,
        },
      })
    }

    console.log('  Created team targets')

    // ─── Client Targets (FY26/27) ─────────────────────────────────────

    // Mike's client targets
    for (const q of fyQuarters) {
      await prisma.clientTarget.upsert({
        where: { userId_accountId_period: { userId: rep1.id, accountId: account1.id, period: q } },
        update: { nfiTargetGBP: 25000 },
        create: {
          userId: rep1.id,
          accountId: account1.id,
          period: q,
          nfiTargetGBP: 25000,
        },
      })
    }

    // Emily's client targets
    for (const q of fyQuarters) {
      await prisma.clientTarget.upsert({
        where: { userId_accountId_period: { userId: rep2.id, accountId: account2.id, period: q } },
        update: { nfiTargetGBP: 20000 },
        create: {
          userId: rep2.id,
          accountId: account2.id,
          period: q,
          nfiTargetGBP: 20000,
        },
      })
    }

    console.log('  Created client targets')
  } catch (err) {
    console.log('  Skipped sample data (may already exist):', (err as Error).message)
  }

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
