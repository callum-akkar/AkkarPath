import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Bulk approve commission entries
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { role } = session.user
    if (role !== 'ADMIN' && role !== 'MANAGER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { entryIds, period } = body

    if (entryIds && Array.isArray(entryIds)) {
      // Approve specific entries
      const result = await prisma.commissionEntry.updateMany({
        where: { id: { in: entryIds }, status: 'PENDING' },
        data: { status: 'APPROVED' },
      })
      return NextResponse.json({ approved: result.count })
    }

    if (period) {
      // Approve all PENDING entries in a period
      const where: Record<string, unknown> = { period, status: 'PENDING' }

      // Managers can only approve their team
      if (role === 'MANAGER') {
        const team = await prisma.user.findMany({
          where: { OR: [{ id: session.user.id }, { managerId: session.user.id }] },
          select: { id: true },
        })
        where.userId = { in: team.map(u => u.id) }
      }

      const result = await prisma.commissionEntry.updateMany({
        where,
        data: { status: 'APPROVED' },
      })
      return NextResponse.json({ approved: result.count })
    }

    return NextResponse.json({ error: 'Provide entryIds or period' }, { status: 400 })
  } catch (error) {
    console.error('Approve error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
