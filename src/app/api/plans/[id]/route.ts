import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const { name, description, planType, tiers } = await req.json()

    // Update plan basics
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (planType !== undefined) updateData.planType = planType

    const plan = await prisma.commissionPlan.update({
      where: { id },
      data: updateData,
    })

    // If tiers provided, replace them all
    if (tiers) {
      await prisma.planTier.deleteMany({ where: { planId: id } })
      await prisma.planTier.createMany({
        data: tiers.map((tier: { minAmount: number; maxAmount: number | null; rate: number }, index: number) => ({
          planId: id,
          minAmount: tier.minAmount || 0,
          maxAmount: tier.maxAmount || null,
          rate: tier.rate,
          orderIndex: index,
        })),
      })
    }

    const updated = await prisma.commissionPlan.findUnique({
      where: { id },
      include: {
        tiers: { orderBy: { orderIndex: 'asc' } },
        _count: { select: { users: true } },
      },
    })

    return NextResponse.json({ plan: updated })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params

    await prisma.commissionPlan.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error deleting plan' }, { status: 400 })
  }
}
