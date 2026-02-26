import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hibobService } from '@/lib/hibob'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const triggeredBy = session.user.email || session.user.id
    const result = await hibobService.syncSalaries(triggeredBy)

    return NextResponse.json(result)
  } catch (error) {
    console.error('HiBob sync error:', error)
    return NextResponse.json({
      error: 'HiBob sync failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
