import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Add a component to a plan
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: planId } = await params
    const body = await req.json()
    const {
      name, type, rate, isPercentage,
      minValue, maxValue, tier,
      accountFilter, kickerThreshold,
    } = body

    if (!name || !type || rate === undefined) {
      return NextResponse.json({ error: 'name, type, and rate are required' }, { status: 400 })
    }

    const component = await prisma.planComponent.create({
      data: {
        commissionPlanId: planId,
        name,
        type,
        rate: parseFloat(rate),
        isPercentage: isPercentage !== false,
        minValue: minValue ? parseFloat(minValue) : null,
        maxValue: maxValue ? parseFloat(maxValue) : null,
        tier: tier ? parseInt(tier) : null,
        accountFilter: accountFilter || null,
        kickerThreshold: kickerThreshold ? parseFloat(kickerThreshold) : null,
      },
    })

    return NextResponse.json(component, { status: 201 })
  } catch (error) {
    console.error('Component POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Delete a component
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const componentId = searchParams.get('componentId')

    if (!componentId) {
      return NextResponse.json({ error: 'componentId is required' }, { status: 400 })
    }

    await prisma.planComponent.update({
      where: { id: componentId },
      data: { isActive: false },
    })

    return NextResponse.json({ deactivated: true })
  } catch (error) {
    console.error('Component DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
