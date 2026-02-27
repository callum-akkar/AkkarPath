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
      triggerType, triggerValue, triggerCondition,
      clientAccountId, excludeOwnDeals, flatAmount, notes,
    } = body

    if (!name || !type) {
      return NextResponse.json({ error: 'name and type are required' }, { status: 400 })
    }

    const component = await prisma.planComponent.create({
      data: {
        commissionPlanId: planId,
        name,
        type,
        rate: rate !== undefined && rate !== null && rate !== '' ? parseFloat(rate) : null,
        isPercentage: isPercentage !== false,
        minValue: minValue ? parseFloat(minValue) : null,
        maxValue: maxValue ? parseFloat(maxValue) : null,
        tier: tier ? parseInt(tier) : null,
        accountFilter: accountFilter || null,
        kickerThreshold: kickerThreshold ? parseFloat(kickerThreshold) : null,
        triggerType: triggerType || null,
        triggerValue: triggerValue ? parseFloat(triggerValue) : null,
        triggerCondition: triggerCondition || null,
        clientAccountId: clientAccountId || null,
        excludeOwnDeals: excludeOwnDeals === true,
        flatAmount: flatAmount !== undefined && flatAmount !== null && flatAmount !== '' ? parseFloat(flatAmount) : null,
        notes: notes || null,
      },
    })

    return NextResponse.json(component, { status: 201 })
  } catch (error) {
    console.error('Component POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Update a component
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await params // consume params
    const body = await req.json()
    const {
      componentId, name, type, rate, isPercentage,
      minValue, maxValue, tier,
      accountFilter, kickerThreshold,
      triggerType, triggerValue, triggerCondition,
      clientAccountId, excludeOwnDeals, flatAmount, notes,
    } = body

    if (!componentId) {
      return NextResponse.json({ error: 'componentId is required' }, { status: 400 })
    }

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (type !== undefined) data.type = type
    if (rate !== undefined) data.rate = rate !== null && rate !== '' ? parseFloat(rate) : null
    if (isPercentage !== undefined) data.isPercentage = isPercentage
    if (minValue !== undefined) data.minValue = minValue ? parseFloat(minValue) : null
    if (maxValue !== undefined) data.maxValue = maxValue ? parseFloat(maxValue) : null
    if (tier !== undefined) data.tier = tier ? parseInt(tier) : null
    if (accountFilter !== undefined) data.accountFilter = accountFilter || null
    if (kickerThreshold !== undefined) data.kickerThreshold = kickerThreshold ? parseFloat(kickerThreshold) : null
    if (triggerType !== undefined) data.triggerType = triggerType || null
    if (triggerValue !== undefined) data.triggerValue = triggerValue ? parseFloat(triggerValue) : null
    if (triggerCondition !== undefined) data.triggerCondition = triggerCondition || null
    if (clientAccountId !== undefined) data.clientAccountId = clientAccountId || null
    if (excludeOwnDeals !== undefined) data.excludeOwnDeals = excludeOwnDeals === true
    if (flatAmount !== undefined) data.flatAmount = flatAmount !== null && flatAmount !== '' ? parseFloat(flatAmount) : null
    if (notes !== undefined) data.notes = notes || null

    const component = await prisma.planComponent.update({
      where: { id: componentId },
      data,
    })

    return NextResponse.json(component)
  } catch (error) {
    console.error('Component PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Deactivate a component
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
