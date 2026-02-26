import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Bulk mark commission entries as paid
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { entryIds, period } = body

    const payoutDate = new Date()

    if (entryIds && Array.isArray(entryIds)) {
      const result = await prisma.commissionEntry.updateMany({
        where: { id: { in: entryIds }, status: 'APPROVED' },
        data: { status: 'PAID', payoutDate },
      })
      return NextResponse.json({ paid: result.count })
    }

    if (period) {
      const result = await prisma.commissionEntry.updateMany({
        where: { period, status: 'APPROVED' },
        data: { status: 'PAID', payoutDate },
      })
      return NextResponse.json({ paid: result.count })
    }

    return NextResponse.json({ error: 'Provide entryIds or period' }, { status: 400 })
  } catch (error) {
    console.error('Pay error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
