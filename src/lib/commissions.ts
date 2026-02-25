import { prisma } from './db'

interface PlanTier {
  minAmount: number
  maxAmount: number | null
  rate: number
  orderIndex: number
}

interface CommissionPlan {
  id: string
  planType: string
  ote: number
  baseSalary: number
  quotaAmount: number
  tiers: PlanTier[]
}

export function calculateCommission(dealAmount: number, plan: CommissionPlan): number {
  if (!plan.tiers.length) return 0

  const sortedTiers = [...plan.tiers].sort((a, b) => a.orderIndex - b.orderIndex)

  switch (plan.planType) {
    case 'flat_rate': {
      const rate = sortedTiers[0].rate
      return dealAmount * rate
    }

    case 'tiered': {
      let remaining = dealAmount
      let commission = 0

      for (const tier of sortedTiers) {
        if (remaining <= 0) break

        const tierMax = tier.maxAmount ?? Infinity
        const tierRange = tierMax - tier.minAmount
        const amountInTier = Math.min(remaining, tierRange)

        commission += amountInTier * tier.rate
        remaining -= amountInTier
      }

      return commission
    }

    case 'accelerator': {
      let applicableRate = sortedTiers[0].rate

      for (const tier of sortedTiers) {
        if (dealAmount >= tier.minAmount) {
          applicableRate = tier.rate
        }
      }

      return dealAmount * applicableRate
    }

    default:
      return dealAmount * (sortedTiers[0]?.rate ?? 0)
  }
}

// Calculate attainment percentage for a rep in a period
export async function getRepAttainment(repId: string, period: string) {
  const quota = await prisma.quotaTarget.findUnique({
    where: { repId_period: { repId, period } },
  })

  const targetAmount = quota?.targetAmount ?? 0

  const revenue = await prisma.deal.aggregate({
    where: {
      repId,
      status: 'closed_won',
      closeDate: {
        gte: new Date(`${period}-01`),
        lt: new Date(
          new Date(`${period}-01`).setMonth(
            new Date(`${period}-01`).getMonth() + 1
          )
        ),
      },
    },
    _sum: { amount: true },
  })

  const actual = revenue._sum.amount || 0
  const attainmentPct = targetAmount > 0 ? actual / targetAmount : 0

  return { targetAmount, actual, attainmentPct, period }
}

// Compute full earnings path: what a rep earns at different attainment levels
export function computeEarningsPath(plan: CommissionPlan, annualQuota: number) {
  const steps = [0, 25, 50, 75, 100, 110, 120, 130, 150, 200]
  const variablePay = plan.ote - plan.baseSalary

  return steps.map((pct) => {
    const attainment = pct / 100
    const revenue = annualQuota * attainment

    // Calculate total commission based on plan tiers
    const commission = calculateCommission(revenue, plan)

    // For accelerator plans, the earnings map directly to commission
    // For simple plans, scale variable pay by attainment
    let totalEarnings: number
    if (plan.tiers.length > 0) {
      totalEarnings = plan.baseSalary + commission
    } else {
      totalEarnings = plan.baseSalary + variablePay * attainment
    }

    return {
      attainmentPct: pct,
      revenue,
      commission,
      baseSalary: plan.baseSalary,
      totalEarnings,
    }
  })
}

// Project year-end attainment based on current pace
export async function getRepProjection(repId: string) {
  const now = new Date()
  const currentMonth = now.getMonth() + 1 // 1-12
  const currentYear = now.getFullYear()

  // Revenue this year so far
  const yearStart = new Date(currentYear, 0, 1)
  const yearEnd = new Date(currentYear + 1, 0, 1)

  const ytdRevenue = await prisma.deal.aggregate({
    where: {
      repId,
      status: 'closed_won',
      closeDate: { gte: yearStart, lt: yearEnd },
    },
    _sum: { amount: true },
  })

  const ytdActual = ytdRevenue._sum.amount || 0

  // Pipeline value (open deals)
  const pipeline = await prisma.deal.aggregate({
    where: { repId, status: 'open' },
    _sum: { amount: true },
  })
  const pipelineTotal = pipeline._sum.amount || 0

  // User's plan for OTE/quota info
  const user = await prisma.user.findUnique({
    where: { id: repId },
    include: { plan: { include: { tiers: true } } },
  })

  // Annual quota: sum of all monthly quota targets for the year, or fall back to plan default
  const quotaTargets = await prisma.quotaTarget.findMany({
    where: {
      repId,
      period: { startsWith: `${currentYear}-` },
      periodType: 'monthly',
    },
  })

  let annualQuota = quotaTargets.reduce((sum, q) => sum + q.targetAmount, 0)
  if (annualQuota === 0 && user?.plan?.quotaAmount) {
    annualQuota = user.plan.quotaAmount
  }

  // Monthly run rate
  const monthsElapsed = Math.max(currentMonth - 1 + now.getDate() / 30, 1)
  const monthlyRate = ytdActual / monthsElapsed
  const projectedYear = monthlyRate * 12

  const ytdAttainment = annualQuota > 0 ? ytdActual / annualQuota : 0
  const projectedAttainment = annualQuota > 0 ? projectedYear / annualQuota : 0

  return {
    ytdActual,
    annualQuota,
    pipelineTotal,
    monthlyRate,
    projectedYear,
    ytdAttainment,
    projectedAttainment,
    ote: user?.plan?.ote || 0,
    baseSalary: user?.plan?.baseSalary || 0,
    plan: user?.plan || null,
    currentMonth,
  }
}

export async function calculateRepCommissions(repId: string, period: string) {
  const user = await prisma.user.findUnique({
    where: { id: repId },
    include: {
      plan: { include: { tiers: true } },
      deals: {
        where: {
          status: 'closed_won',
          closeDate: {
            gte: new Date(`${period}-01`),
            lt: new Date(
              new Date(`${period}-01`).setMonth(
                new Date(`${period}-01`).getMonth() + 1
              )
            ),
          },
        },
      },
    },
  })

  if (!user || !user.plan) return []

  return user.deals.map((deal) => ({
    dealId: deal.id,
    dealName: deal.name,
    dealAmount: deal.amount,
    commissionAmount: calculateCommission(deal.amount, user.plan!),
    period,
  }))
}

export async function generateCommissions(repId: string, period: string) {
  const commissionData = await calculateRepCommissions(repId, period)

  const user = await prisma.user.findUnique({
    where: { id: repId },
    select: { planId: true },
  })

  if (!user?.planId) return []

  const results = []

  for (const data of commissionData) {
    const existing = await prisma.commission.findFirst({
      where: { dealId: data.dealId, period: data.period },
    })

    if (!existing) {
      const commission = await prisma.commission.create({
        data: {
          amount: data.commissionAmount,
          period: data.period,
          dealId: data.dealId,
          repId: repId,
          planId: user.planId,
        },
      })
      results.push(commission)
    }
  }

  return results
}
