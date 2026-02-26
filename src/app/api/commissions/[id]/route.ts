import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createClawback } from '@/lib/commission-engine'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const entry = await prisma.commissionEntry.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        planComponent: true,
        sourcePlacement: { include: { account: true } },
        sourceTimesheet: { include: { account: true } },
        clawbackOfEntry: true,
        clawbackEntries: true,
      },
    })

    if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // REPs can only see their own
    if (session.user.role === 'REP' && entry.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(entry)
  } catch (error) {
    console.error('Commission GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { role } = session.user
    if (role !== 'ADMIN' && role !== 'MANAGER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const { action, holdReason, note } = body

    const entry = await prisma.commissionEntry.findUnique({ where: { id } })
    if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    switch (action) {
      case 'approve':
        if (entry.status !== 'PENDING') {
          return NextResponse.json({ error: 'Can only approve PENDING entries' }, { status: 400 })
        }
        await prisma.commissionEntry.update({
          where: { id },
          data: { status: 'APPROVED' },
        })
        break

      case 'pay':
        if (role !== 'ADMIN') return NextResponse.json({ error: 'Only admins can mark as paid' }, { status: 403 })
        if (entry.status !== 'APPROVED') {
          return NextResponse.json({ error: 'Can only pay APPROVED entries' }, { status: 400 })
        }
        await prisma.commissionEntry.update({
          where: { id },
          data: { status: 'PAID', payoutDate: new Date() },
        })
        break

      case 'hold':
        if (entry.status === 'PAID') {
          return NextResponse.json({ error: 'Cannot hold PAID entries' }, { status: 400 })
        }
        await prisma.commissionEntry.update({
          where: { id },
          data: { status: 'HELD', holdReason: holdReason || 'Held by admin' },
        })
        break

      case 'release':
        if (entry.status !== 'HELD') {
          return NextResponse.json({ error: 'Can only release HELD entries' }, { status: 400 })
        }
        await prisma.commissionEntry.update({
          where: { id },
          data: { status: 'PENDING', holdReason: null },
        })
        break

      case 'clawback':
        if (role !== 'ADMIN') return NextResponse.json({ error: 'Only admins can clawback' }, { status: 403 })
        const clawback = await createClawback(id, session.user.id, note)
        return NextResponse.json(clawback)

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const updated = await prisma.commissionEntry.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true } } },
    })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Commission PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
