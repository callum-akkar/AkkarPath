import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const { name, description, planType, tiers, ote, baseSalary, quotaAmount, payFrequency, hasRamp, rampSchedule } = await req.json()

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (planType !== undefined) updateData.planType = planType
    if (ote !== undefined) updateData.ote = parseFloat(ote)
    if (baseSalary !== undefined) updateData.baseSalary = parseFloat(baseSalary)
    if (quotaAmount !== undefined) updateData.quotaAmount = parseFloat(quotaAmount)
    if (payFrequency !== undefined) updateData.payFrequency = payFrequency
    if (hasRamp !== undefined) updateData.hasRamp = hasRamp

    await prisma.commissionPlan.update({
      where: { id },
      data: updateData,
    })

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

    if (rampSchedule !== undefined) {
      await prisma.rampPeriod.deleteMany({ where: { planId: id } })
      if (rampSchedule && rampSchedule.length > 0) {
        await prisma.rampPeriod.createMany({
          data: rampSchedule.map((r: { month: number; quotaPct: number; commissionPct: number }) => ({
            planId: id,
            month: r.month,
            quotaPct: r.quotaPct,
            commissionPct: r.commissionPct,
          })),
        })
      }
    }

    const updated = await prisma.commissionPlan.findUnique({
      where: { id },
      include: {
        tiers: { orderBy: { orderIndex: 'asc' } },
        rampSchedule: { orderBy: { month: 'asc' } },
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
