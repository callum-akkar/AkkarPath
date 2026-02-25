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
  tiers: PlanTier[]
}

export function calculateCommission(dealAmount: number, plan: CommissionPlan): number {
  if (!plan.tiers.length) return 0

  const sortedTiers = [...plan.tiers].sort((a, b) => a.orderIndex - b.orderIndex)

  switch (plan.planType) {
    case 'flat_rate': {
      // Simple flat rate - use the first tier's rate
      const rate = sortedTiers[0].rate
      return dealAmount * rate
    }

    case 'tiered': {
      // Each portion of the deal in a tier gets that tier's rate
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
      // The entire deal gets the rate of the highest tier it falls into
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
    // Check if commission already exists for this deal/period
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
