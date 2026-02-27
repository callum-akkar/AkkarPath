import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { role, id: currentUserId } = session.user

    // Query params for filtering
    const searchParams = req.nextUrl.searchParams
    const roleFilter = searchParams.get('role')
    const managerIdFilter = searchParams.get('managerId')
    const searchFilter = searchParams.get('search')
    const planIdFilter = searchParams.get('planId')
    const sortField = searchParams.get('sort') || 'name'
    const sortOrder = searchParams.get('order') || 'asc'

    // Build where clause
    const where: Record<string, unknown> = {}

    // Role-based access control
    if (role === 'MANAGER') {
      where.OR = [{ id: currentUserId }, { managerId: currentUserId }]
    } else if (role === 'REP') {
      where.id = currentUserId
    }

    // Apply filters
    if (roleFilter) {
      where.role = roleFilter
    }
    if (managerIdFilter) {
      where.managerId = managerIdFilter
    }
    if (searchFilter) {
      const searchConditions = [
        { name: { contains: searchFilter, mode: 'insensitive' as const } },
        { email: { contains: searchFilter, mode: 'insensitive' as const } },
        { jobTitle: { contains: searchFilter, mode: 'insensitive' as const } },
      ]
      if (where.OR) {
        // Combine role-based OR with search OR using AND
        where.AND = [{ OR: where.OR }, { OR: searchConditions }]
        delete where.OR
      } else {
        where.OR = searchConditions
      }
    }

    // Build orderBy
    type OrderByType = Record<string, string | Record<string, string>>
    let orderBy: OrderByType = { name: 'asc' }
    const validSortFields = ['name', 'role', 'startDate', 'createdAt']
    if (validSortFields.includes(sortField)) {
      orderBy = { [sortField]: sortOrder === 'desc' ? 'desc' : 'asc' }
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
        startDate: true,
        salesforceUserId: true,
        hibobEmployeeId: true,
        salary: role === 'ADMIN',
        createdAt: true,
        _count: { select: { directReports: true, planAssignments: true } },
      },
      orderBy,
    })

    // Filter by plan if requested
    let filteredUsers = users
    if (planIdFilter) {
      const assignments = await prisma.userPlanAssignment.findMany({
        where: { commissionPlanId: planIdFilter },
        select: { userId: true },
      })
      const assignedUserIds = new Set(assignments.map(a => a.userId))
      filteredUsers = users.filter(u => assignedUserIds.has(u.id))
    }

    // Compute totalPaidCommission and totalPaidBonus for each user
    if (role === 'ADMIN' || role === 'MANAGER') {
      const userIds = filteredUsers.map(u => u.id)

      const [commissionSums, bonusSums] = await Promise.all([
        prisma.commissionEntry.groupBy({
          by: ['userId'],
          where: { userId: { in: userIds }, status: 'PAID' },
          _sum: { commissionAmount: true },
        }),
        prisma.bonusEntry.groupBy({
          by: ['userId'],
          where: { userId: { in: userIds }, status: 'PAID' },
          _sum: { amount: true },
        }),
      ])

      const commissionMap = new Map(commissionSums.map(c => [c.userId, Number(c._sum.commissionAmount || 0)]))
      const bonusMap = new Map(bonusSums.map(b => [b.userId, Number(b._sum.amount || 0)]))

      const enriched = filteredUsers.map(u => {
        const totalPaidCommission = commissionMap.get(u.id) || 0
        const totalPaidBonus = bonusMap.get(u.id) || 0
        return {
          ...u,
          totalPaidCommission,
          totalPaidBonus,
          totalEarnings: totalPaidCommission + totalPaidBonus,
        }
      })

      // Sort by totalEarnings if requested
      if (sortField === 'totalEarnings') {
        enriched.sort((a, b) => sortOrder === 'desc' ? b.totalEarnings - a.totalEarnings : a.totalEarnings - b.totalEarnings)
      }

      return NextResponse.json(enriched)
    }

    return NextResponse.json(filteredUsers)
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
