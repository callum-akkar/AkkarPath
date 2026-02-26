import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { calculateCommissions, calculateAllCommissions } from '@/lib/commission-engine'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { period, userId, dryRun } = body

    if (!period) {
      return NextResponse.json({ error: 'Period is required (YYYY-MM)' }, { status: 400 })
    }

    if (userId) {
      // Calculate for a specific user
      const entries = await calculateCommissions(userId, period, { dryRun })
      return NextResponse.json({
        userId,
        period,
        entriesCount: entries.length,
        entries: dryRun ? entries : undefined,
        totalCommission: entries.reduce((sum, e) => sum + e.commissionAmount.toNumber(), 0),
      })
    }

    // Calculate for all users
    const results = await calculateAllCommissions(period, session.user.id)
    return NextResponse.json({
      period,
      results,
      totalUsers: results.length,
      totalEntries: results.reduce((sum, r) => sum + r.entries, 0),
    })
  } catch (error) {
    console.error('Calculate commissions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
