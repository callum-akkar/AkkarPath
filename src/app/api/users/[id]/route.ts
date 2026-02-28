import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    // REPs can only see themselves
    if (session.user.role === 'REP' && id !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        managerId: true,
        manager: { select: { id: true, name: true } },
        directReports: { select: { id: true, name: true, email: true, role: true } },
        jobTitle: true,
        department: true,
        salesforceUserId: true,
        hibobEmployeeId: true,
        salary: session.user.role === 'ADMIN',
        planAssignments: {
          include: {
            commissionPlan: { select: { id: true, name: true } },
            components: { select: { id: true, name: true, type: true, rate: true } },
          },
        },
      },
    })

    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(user)
  } catch (error) {
    console.error('User GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const {
      name, email, password, role, managerId,
      isActive, salesforceUserId, jobTitle, department,
      startDate, salary,
    } = body

    // ─── Validation ─────────────────────────────────────────────
    const warnings: string[] = []

    // Cannot be own manager
    if (managerId !== undefined && managerId === id) {
      return NextResponse.json({ error: 'A user cannot be their own manager' }, { status: 400 })
    }

    // Circular reference check (one level deep)
    if (managerId) {
      const proposedManager = await prisma.user.findUnique({
        where: { id: managerId },
        select: { managerId: true },
      })
      if (proposedManager?.managerId === id) {
        return NextResponse.json(
          { error: 'Circular reference: the selected manager already reports to this user' },
          { status: 400 }
        )
      }
    }

    // Warn if demoting a MANAGER with direct reports
    if (role && role !== 'MANAGER') {
      const current = await prisma.user.findUnique({
        where: { id },
        select: { role: true, _count: { select: { directReports: true } } },
      })
      if (current?.role === 'MANAGER' && current._count.directReports > 0) {
        warnings.push(`This user has ${current._count.directReports} direct report(s) who will need to be reassigned`)
      }
    }

    // ─── Build update data ──────────────────────────────────────
    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (email !== undefined) data.email = email
    if (role !== undefined) data.role = role
    if (managerId !== undefined) data.managerId = managerId || null
    if (isActive !== undefined) data.isActive = isActive
    if (salesforceUserId !== undefined) data.salesforceUserId = salesforceUserId || null
    if (jobTitle !== undefined) data.jobTitle = jobTitle || null
    if (department !== undefined) data.department = department || null
    if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null
    if (salary !== undefined) data.salary = salary !== null && salary !== '' ? parseFloat(salary) : null
    if (password) data.passwordHash = await bcrypt.hash(password, 12)

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        managerId: true,
        manager: { select: { id: true, name: true } },
        directReports: { select: { id: true, name: true, role: true } },
        jobTitle: true,
        department: true,
        startDate: true,
        salary: true,
        salesforceUserId: true,
      },
    })

    return NextResponse.json({ ...user, warnings })
  } catch (error) {
    console.error('User PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
