import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/auth'

export async function GET() {
  try {
    await requireAuth()

    const plans = await prisma.commissionPlan.findMany({
      include: {
        tiers: { orderBy: { orderIndex: 'asc' } },
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
    const { name, description, planType, tiers } = await req.json()

    const plan = await prisma.commissionPlan.create({
      data: {
        name,
        description: description || '',
        planType: planType || 'flat_rate',
        tiers: {
          create: (tiers || []).map((tier: { minAmount: number; maxAmount: number | null; rate: number }, index: number) => ({
            minAmount: tier.minAmount || 0,
            maxAmount: tier.maxAmount || null,
            rate: tier.rate,
            orderIndex: index,
          })),
        },
      },
      include: {
        tiers: { orderBy: { orderIndex: 'asc' } },
      },
    })

    return NextResponse.json({ plan }, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
