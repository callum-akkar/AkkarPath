import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Assign a plan to a user with specific components
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
    const { userId, componentIds, startDate, endDate } = body

    if (!userId || !startDate) {
      return NextResponse.json({ error: 'userId and startDate are required' }, { status: 400 })
    }

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Verify plan exists
    const plan = await prisma.commissionPlan.findUnique({
      where: { id: planId },
      include: { components: { where: { isActive: true } } },
    })
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

    // If no componentIds specified, assign all active components
    const assignComponentIds = componentIds && componentIds.length > 0
      ? componentIds
      : plan.components.map(c => c.id)

    const assignment = await prisma.userPlanAssignment.create({
      data: {
        userId,
        commissionPlanId: planId,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        components: {
          connect: assignComponentIds.map((id: string) => ({ id })),
        },
      },
      include: {
        user: { select: { id: true, name: true } },
        components: { select: { id: true, name: true, type: true } },
      },
    })

    return NextResponse.json(assignment, { status: 201 })
  } catch (error) {
    console.error('Assign POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Remove a plan assignment
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const assignmentId = searchParams.get('assignmentId')

    if (!assignmentId) {
      return NextResponse.json({ error: 'assignmentId is required' }, { status: 400 })
    }

    await prisma.userPlanAssignment.delete({ where: { id: assignmentId } })
    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error('Assignment DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
