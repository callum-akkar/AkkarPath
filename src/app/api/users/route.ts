import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { role } = session.user
    const where: Record<string, unknown> = {}

    if (role === 'MANAGER') {
      where.OR = [{ id: session.user.id }, { managerId: session.user.id }]
    } else if (role === 'REP') {
      where.id = session.user.id
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        managerId: true,
        manager: { select: { id: true, name: true } },
        jobTitle: true,
        department: true,
        salesforceUserId: true,
        hibobEmployeeId: true,
        salary: role === 'ADMIN',
        createdAt: true,
        _count: { select: { directReports: true, planAssignments: true } },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error('Users GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { name, email, password, role, managerId, salesforceUserId, jobTitle, department } = body

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'name, email, and password are required' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: role || 'REP',
        managerId: managerId || null,
        salesforceUserId: salesforceUserId || null,
        jobTitle: jobTitle || null,
        department: department || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        managerId: true,
        jobTitle: true,
        department: true,
      },
    })

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    console.error('User POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
