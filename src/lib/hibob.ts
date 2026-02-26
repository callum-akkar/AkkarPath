import { prisma } from './db'

const HIBOB_CONFIG = {
  apiToken: process.env.HIBOB_API_TOKEN || '',
  baseUrl: process.env.HIBOB_BASE_URL || 'https://api.hibob.com/v1',
}

interface HiBobEmployee {
  id: string
  email: string
  displayName: string
  work?: {
    title?: string
    department?: string
    reportsTo?: { id?: string; email?: string }
  }
  payroll?: {
    salary?: { value?: number; currency?: string }
  }
}

export class HiBobService {
  private async fetchApi(endpoint: string) {
    const res = await fetch(`${HIBOB_CONFIG.baseUrl}${endpoint}`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${HIBOB_CONFIG.apiToken}:`).toString('base64')}`,
        Accept: 'application/json',
      },
    })
    if (!res.ok) throw new Error(`HiBob API error: ${res.status} ${res.statusText}`)
    return res.json()
  }

  async syncSalaries(triggeredBy: string) {
    const syncLog = await prisma.syncLog.create({
      data: { syncType: 'HIBOB_SALARIES', triggeredBy },
    })

    try {
      const data = await this.fetchApi('/people')
      const employees: HiBobEmployee[] = data.employees || []

      let updated = 0

      for (const emp of employees) {
        if (!emp.email) continue

        const user = await prisma.user.findUnique({ where: { email: emp.email } })
        if (!user) continue

        const salary = emp.payroll?.salary?.value ?? null
        const jobTitle = emp.work?.title ?? null
        const department = emp.work?.department ?? null

        await prisma.user.update({
          where: { id: user.id },
          data: {
            hibobEmployeeId: emp.id,
            salary: salary !== null ? salary : undefined,
            jobTitle: jobTitle ?? undefined,
            department: department ?? undefined,
          },
        })
        updated++
      }

      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'SUCCESS',
          recordsProcessed: employees.length,
          recordsUpdated: updated,
          completedAt: new Date(),
        },
      })

      return { processed: employees.length, updated }
    } catch (error) {
      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'FAILED',
          errorLog: error instanceof Error ? error.message : String(error),
          completedAt: new Date(),
        },
      })
      throw error
    }
  }
}

export const hibobService = new HiBobService()
