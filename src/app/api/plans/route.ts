import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/auth'

export async function GET() {
  try {
    await requireAuth()

    const plans = await prisma.commissionPlan.findMany({
      include: {
        tiers: { orderBy: { orderIndex: 'asc' } },
        rampSchedule: { orderBy: { month: 'asc' } },
        _count: { select: { users: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ plans })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const { name, description, planType, tiers, ote, baseSalary, quotaAmount, payFrequency, hasRamp, rampSchedule } = await req.json()

    const plan = await prisma.commissionPlan.create({
      data: {
        name,
        description: description || '',
        planType: planType || 'flat_rate',
        ote: ote ? parseFloat(ote) : 0,
        baseSalary: baseSalary ? parseFloat(baseSalary) : 0,
        quotaAmount: quotaAmount ? parseFloat(quotaAmount) : 0,
        payFrequency: payFrequency || 'monthly',
        hasRamp: hasRamp || false,
        tiers: {
          create: (tiers || []).map((tier: { minAmount: number; maxAmount: number | null; rate: number }, index: number) => ({
            minAmount: tier.minAmount || 0,
            maxAmount: tier.maxAmount || null,
            rate: tier.rate,
            orderIndex: index,
          })),
        },
        rampSchedule: hasRamp && rampSchedule ? {
          create: rampSchedule.map((r: { month: number; quotaPct: number; commissionPct: number }) => ({
            month: r.month,
            quotaPct: r.quotaPct,
            commissionPct: r.commissionPct,
          })),
        } : undefined,
      },
      include: {
        tiers: { orderBy: { orderIndex: 'asc' } },
        rampSchedule: { orderBy: { month: 'asc' } },
      },
    })

    return NextResponse.json({ plan }, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
