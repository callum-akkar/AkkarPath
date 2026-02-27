import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const { newName, newFiscalYear } = body

    // Fetch the original plan with components
    const original = await prisma.commissionPlan.findUnique({
      where: { id },
      include: { components: true },
    })

    if (!original) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Create the cloned plan with all components (but not assignments)
    const cloned = await prisma.commissionPlan.create({
      data: {
        name: newName || `${original.name} (Copy)`,
        description: original.description,
        fiscalYear: newFiscalYear || original.fiscalYear,
        currency: original.currency,
        isActive: true,
        components: {
          create: original.components.map(c => ({
            name: c.name,
            type: c.type,
            rate: c.rate,
            isPercentage: c.isPercentage,
            minValue: c.minValue,
            maxValue: c.maxValue,
            tier: c.tier,
            accountFilter: c.accountFilter,
            kickerThreshold: c.kickerThreshold,
            isActive: c.isActive,
          })),
        },
      },
      include: {
        components: true,
        assignments: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            components: { select: { id: true, name: true } },
          },
        },
      },
    })

    return NextResponse.json(cloned, { status: 201 })
  } catch (error) {
    console.error('Plan clone error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
