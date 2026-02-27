import { Decimal } from 'decimal.js'
import { prisma } from './db'
import type {
  CommissionEntry,
  PlanComponent,
  Placement,
  Timesheet,
  UserPlanAssignment,
  ComponentType,
} from '@prisma/client'

// Decimal.js config for financial precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })

type SourceRecord = {
  type: 'PLACEMENT' | 'TIMESHEET'
  id: string
  salesforceId: string
  name: string
  accountName: string | null
  ownerUserId: string | null
  nfiValue: Decimal
  grossValue: Decimal
  paidDate: Date | null // invoicedDate for placements, weekEnding for timesheets
  placementType: string | null // PERM or CONTRACT
  isClawback: boolean
  commissionPaid: boolean
}

type CalculatedEntry = {
  userId: string
  planComponentId: string
  sourceType: 'PLACEMENT' | 'TIMESHEET'
  sourcePlacementId: string | null
  sourceTimesheetId: string | null
  period: string
  grossValue: Decimal
  commissionAmount: Decimal
  rate: Decimal
  isClawback: boolean
  backdatedFromPeriod: string | null
}

function dateToPeriod(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function periodToDateRange(period: string): { start: Date; end: Date } {
  const [year, month] = period.split('-').map(Number)
  return {
    start: new Date(year, month - 1, 1),
    end: new Date(year, month, 1),
  }
}

function matchesAccountFilter(accountName: string | null, filter: string | null): boolean {
  if (!filter) return true // no filter = matches everything
  if (!accountName) return false
  return accountName.toLowerCase().includes(filter.toLowerCase())
}

function matchesComponentType(component: PlanComponent, record: SourceRecord): boolean {
  const ct = component.type as ComponentType
  switch (ct) {
    case 'PLACEMENT_PERM':
      return record.type === 'PLACEMENT' && record.placementType === 'PERM'
    case 'PLACEMENT_CONTRACT':
      return record.type === 'PLACEMENT' && record.placementType === 'CONTRACT'
    case 'TIMESHEET':
      return record.type === 'TIMESHEET'
    default:
      return false
  }
}

function findTierRate(components: PlanComponent[], nfiValue: Decimal): Decimal {
  // Sort tiers by tier number
  const sorted = [...components].sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0))

  for (const comp of sorted) {
    const min = comp.minValue ? new Decimal(comp.minValue.toString()) : new Decimal(0)
    const max = comp.maxValue ? new Decimal(comp.maxValue.toString()) : null

    if (nfiValue.gte(min) && (!max || nfiValue.lt(max))) {
      return comp.rate ? new Decimal(comp.rate.toString()) : new Decimal(0)
    }
  }

  // Default to first tier if nothing matches
  return sorted.length > 0 && sorted[0].rate ? new Decimal(sorted[0].rate.toString()) : new Decimal(0)
}

function calculateAmount(
  grossValue: Decimal,
  rate: Decimal,
  isPercentage: boolean
): Decimal {
  if (isPercentage) {
    return grossValue.mul(rate)
  }
  // Flat amount
  return rate
}

// ─── Main engine ───────────────────────────────────────────────────

export async function calculateCommissions(
  userId: string,
  period: string,
  options: { dryRun?: boolean; currentPeriod?: string } = {}
): Promise<CalculatedEntry[]> {
  const { dryRun = false, currentPeriod } = options
  const effectiveCurrentPeriod = currentPeriod || dateToPeriod(new Date())
  const { start, end } = periodToDateRange(period)

  // Get user's active plan assignments for this period
  const assignments = await prisma.userPlanAssignment.findMany({
    where: {
      userId,
      startDate: { lte: end },
      OR: [{ endDate: null }, { endDate: { gte: start } }],
    },
    include: {
      components: { where: { isActive: true } },
      commissionPlan: true,
    },
  })

  if (assignments.length === 0) return []

  // Get user for manager override calculation
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { directReports: { select: { id: true } } },
  })
  if (!user) return []

  const directReportIds = user.directReports.map((r) => r.id)

  // Build eligible records from Placements and Timesheets
  const records: SourceRecord[] = []

  // Placements paid in this period
  const placements = await prisma.placement.findMany({
    where: {
      paidToAkkar: true,
      invoicedDate: { gte: start, lt: end },
    },
    include: { account: true },
  })

  for (const pl of placements) {
    records.push({
      type: 'PLACEMENT',
      id: pl.id,
      salesforceId: pl.salesforceId,
      name: pl.name,
      accountName: pl.account?.name || null,
      ownerUserId: pl.ownerUserId,
      nfiValue: new Decimal(pl.nfiValue.toString()),
      grossValue: new Decimal(pl.nfiValue.toString()),
      paidDate: pl.invoicedDate,
      placementType: pl.placementType,
      isClawback: pl.isClawback,
      commissionPaid: pl.commissionPaid,
    })
  }

  // Timesheets paid in this period
  const timesheets = await prisma.timesheet.findMany({
    where: {
      paidToAkkar: true,
      weekEnding: { gte: start, lt: end },
    },
    include: { account: true },
  })

  for (const ts of timesheets) {
    records.push({
      type: 'TIMESHEET',
      id: ts.id,
      salesforceId: ts.salesforceId,
      name: ts.name,
      accountName: ts.account?.name || null,
      ownerUserId: ts.ownerUserId,
      nfiValue: new Decimal(ts.nfiValue.toString()),
      grossValue: new Decimal(ts.grossValue.toString()),
      paidDate: ts.weekEnding,
      placementType: null,
      isClawback: ts.isClawback,
      commissionPaid: ts.commissionPaid,
    })
  }

  const results: CalculatedEntry[] = []

  for (const assignment of assignments) {
    // Group components by name (for tiered)
    const componentsByName = new Map<string, PlanComponent[]>()
    for (const comp of assignment.components) {
      const key = `${comp.name}|${comp.type}`
      const list = componentsByName.get(key) || []
      list.push(comp)
      componentsByName.set(key, list)
    }

    for (const [, comps] of componentsByName) {
      const representative = comps[0]
      const isOverride = representative.type === 'OVERRIDE'
      const isKicker = representative.type === 'KICKER'

      if (isKicker) continue // handled in post-processing

      for (const record of records) {
        // Check ownership: direct owner OR override (manager's team) OR account filter
        const isDirectOwner = record.ownerUserId === userId
        const isTeamMember = isOverride && record.ownerUserId !== null && directReportIds.includes(record.ownerUserId)
        const hasAccountFilter = representative.accountFilter !== null

        if (!isDirectOwner && !isTeamMember && !hasAccountFilter) continue

        // Account filter check
        if (hasAccountFilter && !matchesAccountFilter(record.accountName, representative.accountFilter)) {
          continue
        }

        // For non-override, non-account-filter components, only match direct owner
        if (!isOverride && !hasAccountFilter && !isDirectOwner) continue

        // Type match (PLACEMENT_PERM/CONTRACT/TIMESHEET)
        if (!isOverride && !matchesComponentType(representative, record)) continue

        // For overrides, match the source type broadly
        if (isOverride) {
          // Override components apply to all record types from the team
          // No specific type filtering
        }

        // Determine rate (handle tiers)
        let rate: Decimal
        if (comps.length > 1 && comps[0].tier !== null) {
          rate = findTierRate(comps, record.nfiValue.abs())
        } else {
          rate = representative.rate ? new Decimal(representative.rate.toString()) : new Decimal(0)
        }

        const commissionAmount = calculateAmount(record.nfiValue, rate, representative.isPercentage)

        // Determine period and backdating
        let entryPeriod = period
        let backdatedFromPeriod: string | null = null
        if (period !== effectiveCurrentPeriod) {
          backdatedFromPeriod = period
          entryPeriod = period // Keep in original period by default
        }

        results.push({
          userId,
          planComponentId: representative.id,
          sourceType: record.type,
          sourcePlacementId: record.type === 'PLACEMENT' ? record.id : null,
          sourceTimesheetId: record.type === 'TIMESHEET' ? record.id : null,
          period: entryPeriod,
          grossValue: record.nfiValue,
          commissionAmount,
          rate,
          isClawback: record.isClawback,
          backdatedFromPeriod,
        })
      }
    }
  }

  // Post-processing: KICKER components
  const kickerComponents = assignments.flatMap((a) =>
    a.components.filter((c) => c.type === 'KICKER')
  )

  if (kickerComponents.length > 0) {
    // Calculate total NFI for the user in this period
    const totalNfi = results
      .filter((r) => !r.isClawback)
      .reduce((sum, r) => sum.add(r.grossValue), new Decimal(0))

    for (const kicker of kickerComponents) {
      const threshold = kicker.kickerThreshold
        ? new Decimal(kicker.kickerThreshold.toString())
        : null

      if (threshold && totalNfi.gte(threshold)) {
        // Kicker activated — apply to all eligible records retroactively
        const rate = kicker.rate ? new Decimal(kicker.rate.toString()) : new Decimal(0)

        for (const record of records) {
          if (record.ownerUserId !== userId) continue
          if (record.isClawback) continue

          const kickerAmount = calculateAmount(record.nfiValue, rate, kicker.isPercentage)

          results.push({
            userId,
            planComponentId: kicker.id,
            sourceType: record.type,
            sourcePlacementId: record.type === 'PLACEMENT' ? record.id : null,
            sourceTimesheetId: record.type === 'TIMESHEET' ? record.id : null,
            period,
            grossValue: record.nfiValue,
            commissionAmount: kickerAmount,
            rate,
            isClawback: false,
            backdatedFromPeriod: null,
          })
        }
      }
    }
  }

  // Persist if not dry run
  if (!dryRun) {
    await persistEntries(userId, period, results)
  }

  return results
}

async function persistEntries(
  userId: string,
  period: string,
  entries: CalculatedEntry[]
) {
  // Delete existing PENDING entries for this user/period (never delete PAID)
  await prisma.commissionEntry.deleteMany({
    where: {
      userId,
      period,
      status: 'PENDING',
      isManualOverride: false,
    },
  })

  // Create new entries
  for (const entry of entries) {
    await prisma.commissionEntry.create({
      data: {
        userId: entry.userId,
        planComponentId: entry.planComponentId,
        sourceType: entry.sourceType,
        sourcePlacementId: entry.sourcePlacementId,
        sourceTimesheetId: entry.sourceTimesheetId,
        period: entry.period,
        grossValue: entry.grossValue.toNumber(),
        commissionAmount: entry.commissionAmount.toNumber(),
        rate: entry.rate.toNumber(),
        isClawback: entry.isClawback,
        backdatedFromPeriod: entry.backdatedFromPeriod,
        status: 'PENDING',
      },
    })
  }
}

// Calculate for all users in a period
export async function calculateAllCommissions(period: string, triggeredBy?: string) {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      planAssignments: { some: {} },
    },
    select: { id: true },
  })

  const results: { userId: string; entries: number }[] = []

  for (const user of users) {
    const entries = await calculateCommissions(user.id, period)
    results.push({ userId: user.id, entries: entries.length })
  }

  return results
}

// Create a clawback entry for a specific commission entry
export async function createClawback(
  commissionEntryId: string,
  createdByUserId: string,
  note?: string
) {
  const original = await prisma.commissionEntry.findUnique({
    where: { id: commissionEntryId },
  })

  if (!original) throw new Error('Commission entry not found')

  const clawback = await prisma.commissionEntry.create({
    data: {
      userId: original.userId,
      planComponentId: original.planComponentId,
      sourceType: original.sourceType,
      sourcePlacementId: original.sourcePlacementId,
      sourceTimesheetId: original.sourceTimesheetId,
      period: dateToPeriod(new Date()),
      grossValue: new Decimal(original.grossValue.toString()).neg().toNumber(),
      commissionAmount: new Decimal(original.commissionAmount.toString()).neg().toNumber(),
      rate: original.rate,
      isClawback: true,
      clawbackOfEntryId: original.id,
      status: 'PENDING',
      manualOverrideNote: note || `Clawback of ${original.id}`,
      createdByUserId,
    },
  })

  return clawback
}
