import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const passwordHash = await bcrypt.hash('akkar2026', 12)

  // ─── Users (Pass 1: Create all users) ──────────────────────────────

  const userDefs = [
    { email: 'callum@akkar.com', name: 'Callum Akkar', role: 'ADMIN' as const, title: 'CEO', department: 'Leadership', startDate: new Date('2020-01-15') },
    { email: 'patrick@akkar.com', name: 'Patrick Scott', role: 'MANAGER' as const, title: 'Recruitment Manager - AI', department: 'Recruitment', hibobEmployeeId: '14', startDate: new Date('2021-03-01') },
    { email: 'isabella@akkar.com', name: 'Isabella Smith', role: 'MANAGER' as const, title: 'Recruitment Manager - Embedded Systems', department: 'Recruitment', hibobEmployeeId: '31', startDate: new Date('2021-06-01') },
    { email: 'jonathan@akkar.com', name: 'Jonathan Lant', role: 'MANAGER' as const, title: 'Recruitment Manager - Supply Chain', department: 'Recruitment', hibobEmployeeId: '57-jon', startDate: new Date('2022-01-10') },
    { email: 'edward@akkar.com', name: 'Ed Winbow', role: 'REP' as const, title: 'Account Manager', department: 'Account Management', hibobEmployeeId: '30', startDate: new Date('2021-09-01') },
    { email: 'katy@akkar.com', name: 'Katy Prior', role: 'REP' as const, title: 'Account Manager', department: 'Account Management', hibobEmployeeId: '149', startDate: new Date('2023-07-01') },
    { email: 'joel@akkar.com', name: 'Joel Martinengo', role: 'REP' as const, title: 'Business Development Manager', department: 'Business Development', hibobEmployeeId: '57-joel', startDate: new Date('2022-04-01') },
    { email: 'ben@akkar.com', name: 'Ben Burns', role: 'REP' as const, title: '360 Recruiter', department: 'Recruitment', hibobEmployeeId: '118', startDate: new Date('2023-01-15') },
    { email: 'sam@akkar.com', name: 'Sam Pollard', role: 'REP' as const, title: '360 Recruiter', department: 'Recruitment', hibobEmployeeId: '142', startDate: new Date('2023-06-01') },
    { email: 'david@akkar.com', name: 'David Hatcher', role: 'REP' as const, title: '360 Recruiter', department: 'Recruitment', hibobEmployeeId: '83', startDate: new Date('2022-08-01') },
    { email: 'cyoung@akkar.com', name: 'Callum Young', role: 'REP' as const, title: 'Delivery Recruiter', department: 'Recruitment', hibobEmployeeId: '146', startDate: new Date('2023-09-01') },
    { email: 'bobby@akkar.com', name: 'Bobby Law', role: 'REP' as const, title: 'Delivery Recruiter', department: 'Recruitment', hibobEmployeeId: '163', startDate: new Date('2024-01-15') },
    { email: 'kris@akkar.com', name: 'Kris Masters', role: 'REP' as const, title: '360 Recruiter', department: 'Recruitment', hibobEmployeeId: '131', startDate: new Date('2023-03-01') },
    { email: 'shubhangi@akkar.com', name: 'Shubhangi Anand', role: 'REP' as const, title: 'Delivery Recruiter', department: 'Recruitment', hibobEmployeeId: '150', startDate: new Date('2023-10-01') },
    { email: 'dcourtney@akkar.com', name: 'Dan Courtney', role: 'REP' as const, title: '360 Recruiter', department: 'Recruitment', startDate: new Date('2023-11-01') },
    { email: 'djewell@akkar.com', name: 'Dylan Jewell', role: 'REP' as const, title: 'Delivery Recruiter', department: 'Recruitment', hibobEmployeeId: '84', startDate: new Date('2022-06-01') },
    { email: 'theo@akkar.com', name: 'Theo Baxter Smith', role: 'REP' as const, title: '360 Recruiter', department: 'Recruitment', startDate: new Date('2024-02-01') },
    { email: 'jake@akkar.com', name: 'Jacob Bedwell', role: 'REP' as const, title: '360 Recruiter', department: 'Recruitment', startDate: new Date('2023-05-01') },
    { email: 'ddenkl@akkar.com', name: 'Dan Denkl', role: 'REP' as const, title: 'Delivery Recruiter', department: 'Recruitment', startDate: new Date('2024-03-01') },
    { email: 'luiza@akkar.com', name: 'Luiza Gioria', role: 'REP' as const, title: 'Delivery Recruiter', department: 'Recruitment', startDate: new Date('2024-04-01') },
  ]

  // Create users with upsert
  const userMap = new Map<string, string>() // email -> id
  for (const u of userDefs) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, jobTitle: u.title, department: u.department, startDate: u.startDate },
      create: {
        email: u.email,
        name: u.name,
        passwordHash,
        role: u.role,
        jobTitle: u.title,
        department: u.department,
        startDate: u.startDate,
        hibobEmployeeId: u.hibobEmployeeId || null,
      },
    })
    userMap.set(u.email, user.id)
  }

  console.log(`  Created ${userMap.size} users`)

  // ─── Users (Pass 2: Set manager relationships) ────────────────────

  const managerAssignments: Record<string, string[]> = {
    'patrick@akkar.com': ['ben@akkar.com', 'sam@akkar.com', 'david@akkar.com', 'djewell@akkar.com', 'theo@akkar.com', 'jake@akkar.com'],
    'isabella@akkar.com': ['cyoung@akkar.com', 'bobby@akkar.com', 'kris@akkar.com', 'dcourtney@akkar.com', 'ddenkl@akkar.com', 'luiza@akkar.com'],
    'jonathan@akkar.com': ['shubhangi@akkar.com'],
    'callum@akkar.com': ['patrick@akkar.com', 'isabella@akkar.com', 'jonathan@akkar.com', 'edward@akkar.com', 'katy@akkar.com', 'joel@akkar.com'],
  }

  for (const [managerEmail, reportEmails] of Object.entries(managerAssignments)) {
    const managerId = userMap.get(managerEmail)!
    for (const repEmail of reportEmails) {
      const repId = userMap.get(repEmail)
      if (repId) {
        await prisma.user.update({
          where: { id: repId },
          data: { managerId },
        })
      }
    }
  }

  console.log('  Set manager relationships')

  // ─── SF Accounts ──────────────────────────────────────────────────

  const clientDefs = [
    { name: 'Mobileye', salesforceId: 'SF-MOBILEYE' },
    { name: 'UL Solutions', salesforceId: 'SF-ULSOLUTIONS' },
    { name: 'Stark', salesforceId: 'SF-STARK' },
    { name: 'Garrett', salesforceId: 'SF-GARRETT' },
    { name: 'Forterra', salesforceId: 'SF-FORTERRA' },
    { name: 'BRUSS Sealing Systems', salesforceId: 'SF-BRUSS' },
    { name: 'Indie Semiconductor', salesforceId: 'SF-INDIESEMI' },
    { name: 'Singer', salesforceId: 'SF-SINGER' },
    { name: 'Punch Powertrain', salesforceId: 'SF-PUNCH' },
  ]

  const accountMap = new Map<string, string>() // name -> id
  for (const c of clientDefs) {
    const acc = await prisma.sFAccount.upsert({
      where: { salesforceId: c.salesforceId },
      update: { name: c.name },
      create: { salesforceId: c.salesforceId, name: c.name },
    })
    accountMap.set(c.name, acc.id)
  }

  console.log(`  Created ${accountMap.size} SF accounts`)

  // ─── Commission Plans ─────────────────────────────────────────────

  const planStartDate = new Date('2025-01-01')

  // Helper: upsert a plan with deterministic ID, then recreate its components and assignments.
  // Components/assignments are deleted first so the create() calls are guaranteed safe on re-runs.
  type ComponentDef = Record<string, unknown> & { name: string; type: string }

  async function seedPlan(
    planId: string,
    planData: { name: string; description: string; fiscalYear: string; currency: string },
    componentDefs: ComponentDef[],
    assigneeEmails: string[],
  ) {
    // 1. Upsert the plan itself (deterministic ID)
    await prisma.commissionPlan.upsert({
      where: { id: planId },
      update: { name: planData.name, description: planData.description, fiscalYear: planData.fiscalYear, currency: planData.currency },
      create: { id: planId, ...planData },
    })

    // 2. Clean up old assignments and components (handles FK constraints)
    await prisma.userPlanAssignment.deleteMany({ where: { commissionPlanId: planId } })
    await prisma.commissionEntry.updateMany({
      where: { planComponent: { commissionPlanId: planId } },
      data: { planComponentId: null },
    })
    await prisma.planComponent.deleteMany({ where: { commissionPlanId: planId } })

    // 3. Create fresh components
    const components = []
    for (const cd of componentDefs) {
      const comp = await prisma.planComponent.create({
        data: { commissionPlanId: planId, ...cd } as never,
      })
      components.push(comp)
    }

    // 4. Create fresh assignments
    for (const email of assigneeEmails) {
      const userId = userMap.get(email)
      if (userId) {
        await prisma.userPlanAssignment.create({
          data: {
            userId,
            commissionPlanId: planId,
            startDate: planStartDate,
            components: { connect: components.map(c => ({ id: c.id })) },
          },
        })
      }
    }

    console.log(`  Seeded plan: ${planData.name}`)
  }

  // ── Plan 1: Bonuses + Perm/Contract Placements ────────────────────

  await seedPlan('seed-plan-1', {
    name: 'Bonuses + Perm/Contract Placements - 2025',
    description: 'Standard recruiter plan with perm/contract commission, new client bonus, and quarterly target bonus',
    fiscalYear: '2025',
    currency: 'GBP',
  }, [
    { name: 'Permanent Placements', type: 'PLACEMENT_PERM', rate: 0.10, isPercentage: true, notes: '10% of permanent placement NFI' },
    { name: 'Contract Placements', type: 'PLACEMENT_CONTRACT', rate: 0.15, isPercentage: true, notes: '15% of contract placement margin (some reps have 20%)' },
    { name: 'New Client Bonus', type: 'BONUS_NEW_CLIENT', rate: null, isPercentage: false, flatAmount: 1000, notes: '£1,000 flat bonus for winning a new client' },
    { name: 'High Roller Quarterly Bonus 2025', type: 'BONUS_QUARTERLY_TARGET', rate: null, isPercentage: false, flatAmount: 1000, triggerType: 'quarterly_target', triggerValue: 35000, notes: '£1,000 bonus if quarterly NFI exceeds £35k' },
    { name: 'Override (2)', type: 'OVERRIDE', rate: null, isPercentage: false, flatAmount: 2000, notes: 'Manual override bonus — ad hoc' },
    { name: 'Override (4)', type: 'OVERRIDE', rate: null, isPercentage: false, notes: 'Manual override — variable amount' },
  ], [
    'ben@akkar.com', 'david@akkar.com', 'sam@akkar.com', 'cyoung@akkar.com',
    'bobby@akkar.com', 'kris@akkar.com', 'shubhangi@akkar.com', 'dcourtney@akkar.com',
    'djewell@akkar.com', 'theo@akkar.com', 'jake@akkar.com', 'ddenkl@akkar.com',
    'luiza@akkar.com', 'isabella@akkar.com', 'joel@akkar.com', 'patrick@akkar.com',
    'edward@akkar.com',
  ])

  // ── Plan 2: Recruitment Manager - Pat ─────────────────────────────

  await seedPlan('seed-plan-2', {
    name: 'Recruitment Manager - Pat (2025)',
    description: 'Manager override for Patrick Scott — AI team',
    fiscalYear: '2025',
    currency: 'GBP',
  }, [
    { name: 'Recruitment Manager - AI Perm Placements (Excluding Pat)', type: 'MANAGER_OVERRIDE_PERM', rate: 0.01, isPercentage: true, excludeOwnDeals: true, notes: "1% of AI team's perm placement revenue, excluding Pat's own deals" },
    { name: 'Recruitment Manager - AI Contract (Excluding Pat)', type: 'MANAGER_OVERRIDE_CONTRACT', rate: 0.01, isPercentage: true, excludeOwnDeals: true, notes: "1% of AI team's contract revenue, excluding Pat's own deals" },
  ], ['patrick@akkar.com'])

  // ── Plan 3: Recruitment Manager - Bella ───────────────────────────

  await seedPlan('seed-plan-3', {
    name: 'Recruitment Manager - Bella (2025)',
    description: 'Manager override for Isabella Smith — Embedded Systems team',
    fiscalYear: '2025',
    currency: 'GBP',
  }, [
    { name: 'Recruitment Manager - Embedded Systems Perm Placements (Excluding Bella)', type: 'MANAGER_OVERRIDE_PERM', rate: 0.01, isPercentage: true, excludeOwnDeals: true, notes: "1% of Embedded Systems team's perm revenue, excluding Bella's own" },
    { name: 'Recruitment Manager - Embedded Systems Contract (Excluding Bella)', type: 'MANAGER_OVERRIDE_CONTRACT', rate: 0.01, isPercentage: true, excludeOwnDeals: true, notes: "1% of Embedded Systems team's contract revenue, excluding Bella's own" },
  ], ['isabella@akkar.com'])

  // ── Plan 4: Recruitment Manager - Jon ─────────────────────────────

  await seedPlan('seed-plan-4', {
    name: 'Recruitment Manager - Jon (2025)',
    description: 'Manager override for Jonathan Lant — Supply Chain team',
    fiscalYear: '2025',
    currency: 'GBP',
  }, [
    { name: 'Recruitment Manager - Supply Chain Perm Placements (Excluding Jon)', type: 'MANAGER_OVERRIDE_PERM', rate: 0.01, isPercentage: true, excludeOwnDeals: true, notes: "1% of Supply Chain team's perm revenue, excluding Jon's own" },
  ], ['jonathan@akkar.com'])

  // ── Plan 5: Ed Winbow - Account Management ────────────────────────

  await seedPlan('seed-plan-5', {
    name: 'Ed Winbow - Account Management - 2025',
    description: 'Account management commission for Ed Winbow — client-specific rates',
    fiscalYear: '2025',
    currency: 'GBP',
  }, [
    { name: 'Mobileye - Permanent Placements', type: 'AM_CLIENT_PERM', rate: 0.007, isPercentage: true, clientAccountId: accountMap.get('Mobileye')! },
    { name: 'Mobileye - Contract Placements', type: 'AM_CLIENT_CONTRACT', rate: 0.007, isPercentage: true, clientAccountId: accountMap.get('Mobileye')! },
    { name: 'UL Solutions - Permanent Placements', type: 'AM_CLIENT_PERM', rate: 0.007, isPercentage: true, clientAccountId: accountMap.get('UL Solutions')!, notes: 'Select placements only/no individual bonus' },
    { name: 'Garrett - Permanent Placements', type: 'AM_CLIENT_PERM', rate: 0.007, isPercentage: true, clientAccountId: accountMap.get('Garrett')! },
  ], ['edward@akkar.com'])

  // ── Plan 6: Katy Prior - Account Management ───────────────────────

  await seedPlan('seed-plan-6', {
    name: 'Katy Prior - Account Management - 2025',
    description: 'Account management commission for Katy Prior — client-specific rates',
    fiscalYear: '2025',
    currency: 'GBP',
  }, [
    { name: 'Stark - Permanent Placements', type: 'AM_CLIENT_PERM', rate: 0.007, isPercentage: true, clientAccountId: accountMap.get('Stark')! },
    { name: 'Indie Semiconductor - Permanent Placements', type: 'AM_CLIENT_PERM', rate: 0.007, isPercentage: true, clientAccountId: accountMap.get('Indie Semiconductor')! },
    { name: 'Indie Semiconductor - Contract Placements', type: 'AM_CLIENT_CONTRACT', rate: 0.007, isPercentage: true, clientAccountId: accountMap.get('Indie Semiconductor')! },
    { name: 'Garrett - Permanent Placements', type: 'AM_CLIENT_PERM', rate: 0.007, isPercentage: true, clientAccountId: accountMap.get('Garrett')! },
    { name: 'BRUSS Sealing Systems - Permanent Placements', type: 'AM_CLIENT_PERM', rate: 0.007, isPercentage: true, clientAccountId: accountMap.get('BRUSS Sealing Systems')! },
    { name: 'Singer - Contract Placements', type: 'AM_CLIENT_CONTRACT', rate: 0.007, isPercentage: true, clientAccountId: accountMap.get('Singer')! },
  ], ['katy@akkar.com'])

  // ── Plan 7: Business Development ──────────────────────────────────

  await seedPlan('seed-plan-7', {
    name: 'Business Development - 2025',
    description: 'BD ongoing commission on timesheets for BD-originated placements',
    fiscalYear: '2025',
    currency: 'GBP',
  }, [
    { name: 'Business Development - Ongoing Commission (Timesheets)', type: 'BD_ONGOING', rate: 0.03, isPercentage: true, notes: '3% ongoing commission on timesheets for BD-originated placements' },
  ], ['joel@akkar.com'])

  // ─── Sample Placements ────────────────────────────────────────────

  const placementDefs = [
    { salesforceId: 'PL-1287', type: 'PERM' as const, nfi: 14156.00, candidate: 'Candidate A', date: new Date('2025-04-30'), account: 'BRUSS Sealing Systems', owner: 'sam@akkar.com' },
    { salesforceId: 'PL-1288', type: 'PERM' as const, nfi: 10000.00, candidate: 'Candidate B', date: new Date('2025-05-02'), account: 'Mobileye', owner: 'kris@akkar.com' },
    { salesforceId: 'PL-1289', type: 'PERM' as const, nfi: 26120.00, candidate: 'Candidate C', date: new Date('2025-05-06'), account: 'Indie Semiconductor', owner: 'kris@akkar.com' },
    { salesforceId: 'PL-1292', type: 'PERM' as const, nfi: 25060.00, candidate: 'Candidate D', date: new Date('2025-05-07'), account: 'Stark', owner: 'sam@akkar.com' },
    { salesforceId: 'PL-1294', type: 'PERM' as const, nfi: 13042.00, candidate: 'Candidate E', date: new Date('2025-05-09'), account: 'Mobileye', owner: 'kris@akkar.com' },
    { salesforceId: 'PL-1298', type: 'PERM' as const, nfi: 10000.00, candidate: 'Candidate F', date: new Date('2025-05-09'), account: 'Stark', owner: 'ben@akkar.com' },
    { salesforceId: 'PL-1301', type: 'PERM' as const, nfi: 13684.00, candidate: 'Candidate G', date: new Date('2025-05-14'), account: 'Garrett', owner: 'david@akkar.com' },
    { salesforceId: 'PL-1306', type: 'PERM' as const, nfi: 15000.00, candidate: 'Candidate H', date: new Date('2025-06-02'), account: 'Indie Semiconductor', owner: 'kris@akkar.com' },
    { salesforceId: 'PL-1310', type: 'PERM' as const, nfi: 30000.00, candidate: 'Candidate I', date: new Date('2025-06-13'), account: 'UL Solutions', owner: 'sam@akkar.com' },
    { salesforceId: 'PL-1323', type: 'PERM' as const, nfi: 20603.00, candidate: 'Candidate J', date: new Date('2025-06-27'), account: 'Mobileye', owner: 'ben@akkar.com' },
    { salesforceId: 'PL-1251', type: 'PERM' as const, nfi: 5385.00, candidate: 'Candidate K', date: new Date('2025-04-07'), account: 'Stark', owner: 'shubhangi@akkar.com' },
    { salesforceId: 'PL-1269', type: 'PERM' as const, nfi: 10000.00, candidate: 'Candidate L', date: new Date('2025-04-15'), account: 'Stark', owner: 'shubhangi@akkar.com' },
    { salesforceId: 'PL-1272', type: 'PERM' as const, nfi: 9240.00, candidate: 'Candidate M', date: new Date('2025-04-24'), account: 'Stark', owner: 'bobby@akkar.com' },
    { salesforceId: 'PL-1254', type: 'PERM' as const, nfi: 12000.00, candidate: 'Candidate N', date: new Date('2025-04-09'), account: 'Forterra', owner: 'shubhangi@akkar.com' },
  ]

  for (const pl of placementDefs) {
    const ownerUserId = userMap.get(pl.owner)!
    const accountId = accountMap.get(pl.account)!
    await prisma.placement.upsert({
      where: { salesforceId: pl.salesforceId },
      update: { nfiValue: pl.nfi, ownerUserId, accountId },
      create: {
        salesforceId: pl.salesforceId,
        name: `${pl.salesforceId} ${pl.candidate}`,
        accountId,
        ownerSalesforceUserId: 'SF_USER_PLACEHOLDER',
        ownerUserId,
        nfiValue: pl.nfi,
        placedDate: new Date(pl.date.getTime() - 14 * 24 * 60 * 60 * 1000),
        invoicedDate: pl.date,
        paidToAkkar: true,
        placementType: pl.type,
        candidateName: pl.candidate,
      },
    })
  }
  console.log(`  Created ${placementDefs.length} sample placements`)

  // ─── Commission Entries (Paid) ────────────────────────────────────

  const repTotals = [
    { email: 'ben@akkar.com', total: 23439.40 },
    { email: 'bobby@akkar.com', total: 4490.04 },
    { email: 'cyoung@akkar.com', total: 14711.69 },
    { email: 'david@akkar.com', total: 15228.01 },
    { email: 'djewell@akkar.com', total: 4019.91 },
    { email: 'edward@akkar.com', total: 7637.64 },
    { email: 'isabella@akkar.com', total: 17061.68 },
    { email: 'joel@akkar.com', total: 14947.46 },
    { email: 'katy@akkar.com', total: 4810.04 },
    { email: 'kris@akkar.com', total: 9546.25 },
    { email: 'patrick@akkar.com', total: 10978.72 },
    { email: 'sam@akkar.com', total: 9395.93 },
    { email: 'shubhangi@akkar.com', total: 3669.05 },
  ]

  const periods = ['2024-07', '2024-10', '2025-01', '2025-04']

  let totalEntries = 0
  for (const rt of repTotals) {
    const userId = userMap.get(rt.email)
    if (!userId) continue

    const emailKey = rt.email.replace('@akkar.com', '')
    const shares = [0.20, 0.25, 0.30, 0.25]
    for (let i = 0; i < periods.length; i++) {
      const commissionAmount = Math.round(rt.total * shares[i] * 100) / 100
      const grossValue = Math.round(commissionAmount / 0.10 * 100) / 100
      const seedId = `seed-comm-${emailKey}-${periods[i]}`

      await prisma.commissionEntry.upsert({
        where: { id: seedId },
        update: {
          grossValue,
          commissionAmount,
          rate: 0.10,
          status: 'PAID',
          payoutDate: new Date(`${periods[i]}-28`),
        },
        create: {
          id: seedId,
          userId,
          sourceType: 'PLACEMENT',
          period: periods[i],
          grossValue,
          commissionAmount,
          rate: 0.10,
          status: 'PAID',
          payoutDate: new Date(`${periods[i]}-28`),
          isManualOverride: true,
          manualOverrideNote: 'Seed data',
        },
      })
      totalEntries++
    }
  }
  console.log(`  Upserted ${totalEntries} commission entries`)

  // ─── Quarterly Targets (FY25/26) ──────────────────────────────────

  const fyQuarters = ['FY25/26-Q1', 'FY25/26-Q2', 'FY25/26-Q3', 'FY25/26-Q4']

  const targetAmounts: Record<string, number> = {
    '360 Recruiter': 25000,
    'Delivery Recruiter': 15000,
    'Account Manager': 5000,
    'Recruitment Manager - AI': 10000,
    'Recruitment Manager - Embedded Systems': 10000,
    'Recruitment Manager - Supply Chain': 10000,
    'Business Development Manager': 10000,
    'CEO': 0,
  }

  for (const u of userDefs) {
    const userId = userMap.get(u.email)!
    const target = targetAmounts[u.title] || 0
    if (target === 0) continue

    for (const q of fyQuarters) {
      await prisma.target.upsert({
        where: { userId_period: { userId, period: q } },
        update: { nfiTargetGBP: target },
        create: { userId, period: q, nfiTargetGBP: target },
      })
    }
  }
  console.log('  Created quarterly targets')

  // ─── Team Targets (FY25/26) ───────────────────────────────────────

  const teamTargetDefs = [
    { email: 'patrick@akkar.com', target: 150000 },
    { email: 'isabella@akkar.com', target: 120000 },
    { email: 'jonathan@akkar.com', target: 50000 },
    { email: 'callum@akkar.com', target: 350000 },
  ]

  for (const tt of teamTargetDefs) {
    const managerId = userMap.get(tt.email)!
    for (const q of fyQuarters) {
      await prisma.teamTarget.upsert({
        where: { managerId_period: { managerId, period: q } },
        update: { nfiTargetGBP: tt.target },
        create: { managerId, period: q, nfiTargetGBP: tt.target },
      })
    }
  }
  console.log('  Created team targets')

  console.log('')
  console.log('Seed complete!')
  console.log('')
  console.log('Login credentials (password: akkar2026):')
  console.log('  Admin:      callum@akkar.com')
  console.log('  Managers:   patrick@akkar.com, isabella@akkar.com, jonathan@akkar.com')
  console.log('  AMs:        edward@akkar.com, katy@akkar.com')
  console.log('  BD:         joel@akkar.com')
  console.log('  Recruiters: ben@akkar.com, sam@akkar.com, david@akkar.com, kris@akkar.com, ...')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
