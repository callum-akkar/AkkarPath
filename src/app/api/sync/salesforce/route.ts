import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { salesforceService } from '@/lib/salesforce'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const triggeredBy = session.user.email || session.user.id

    // Run syncs sequentially
    const placementResult = await salesforceService.syncPlacements(triggeredBy)
    const timesheetResult = await salesforceService.syncTimesheets(triggeredBy)

    return NextResponse.json({
      placements: placementResult,
      timesheets: timesheetResult,
    })
  } catch (error) {
    console.error('Salesforce sync error:', error)
    return NextResponse.json({
      error: 'Salesforce sync failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
