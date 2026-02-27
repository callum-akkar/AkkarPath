import jsforce from 'jsforce'
import { prisma } from './db'
import type { SyncType } from '@prisma/client'

const SF_CONFIG = {
  loginUrl: process.env.SF_LOGIN_URL || 'https://login.salesforce.com',
  clientId: process.env.SF_CLIENT_ID || '',
  clientSecret: process.env.SF_CLIENT_SECRET || '',
  username: process.env.SF_USERNAME || '',
  password: process.env.SF_PASSWORD || '',
  securityToken: process.env.SF_SECURITY_TOKEN || '',
}

const SF_FIELDS = {
  placementObject: process.env.SF_PLACEMENT_OBJECT || 'Placement__c',
  placementNfiField: process.env.SF_PLACEMENT_NFI_FIELD || 'NFI_Value__c',
  placementPaidField: process.env.SF_PLACEMENT_PAID_FIELD || 'Invoice_Paid__c',
  placementCommPaidField: process.env.SF_PLACEMENT_COMM_PAID_FIELD || 'Commission_Paid__c',
  placementTypeField: process.env.SF_PLACEMENT_TYPE_FIELD || 'Placement_Type__c',
  timesheetObject: process.env.SF_TIMESHEET_OBJECT || 'Timesheet__c',
  timesheetPaidField: process.env.SF_TIMESHEET_PAID_FIELD || 'Invoice_Paid__c',
  timesheetCommPaidField: process.env.SF_TIMESHEET_COMM_PAID_FIELD || 'Commission_Paid__c',
}

export class SalesforceService {
  private conn: jsforce.Connection | null = null

  async connect(): Promise<jsforce.Connection> {
    if (this.conn) return this.conn

    this.conn = new jsforce.Connection({
      loginUrl: SF_CONFIG.loginUrl,
      ...(SF_CONFIG.clientId && SF_CONFIG.clientSecret
        ? { oauth2: { clientId: SF_CONFIG.clientId, clientSecret: SF_CONFIG.clientSecret, loginUrl: SF_CONFIG.loginUrl } }
        : {}),
    })

    await this.conn.login(
      SF_CONFIG.username,
      SF_CONFIG.password + SF_CONFIG.securityToken
    )

    return this.conn
  }

  // Audit SF object fields — discover available field API names
  async describeObject(objectName: string) {
    const conn = await this.connect()
    const desc = await conn.describe(objectName)
    return desc.fields.map((f: { name: string; label: string; type: string }) => ({
      name: f.name,
      label: f.label,
      type: f.type,
    }))
  }

  // TODO: When SF has a Start_Date__c field on the User/Contact object,
  // pull it during sync and populate User.startDate in the database.
  // Example: user.startDate = record.Start_Date__c ? new Date(record.Start_Date__c) : null

  // Build SF user ID → internal User ID map
  private async buildUserMap(): Promise<Map<string, string>> {
    const users = await prisma.user.findMany({
      where: { salesforceUserId: { not: null } },
      select: { id: true, salesforceUserId: true },
    })
    const map = new Map<string, string>()
    for (const u of users) {
      if (u.salesforceUserId) map.set(u.salesforceUserId, u.id)
    }
    return map
  }

  // Resolve or create SFAccount
  private async resolveAccount(sfAccountId: string, accountName: string): Promise<string> {
    const existing = await prisma.sFAccount.findUnique({ where: { salesforceId: sfAccountId } })
    if (existing) {
      if (existing.name !== accountName) {
        await prisma.sFAccount.update({ where: { id: existing.id }, data: { name: accountName } })
      }
      return existing.id
    }
    const created = await prisma.sFAccount.create({
      data: { salesforceId: sfAccountId, name: accountName },
    })
    return created.id
  }

  async syncPlacements(triggeredBy: string, sinceDate?: Date) {
    const syncLog = await prisma.syncLog.create({
      data: { syncType: 'SALESFORCE_PLACEMENTS' as SyncType, triggeredBy },
    })

    try {
      const conn = await this.connect()
      const userMap = await this.buildUserMap()

      let soql = `SELECT Id, Name, Account__c, Account__r.Name, OwnerId, Owner.Email, ${SF_FIELDS.placementNfiField}, Placed_Date__c, Invoice_Date__c, ${SF_FIELDS.placementPaidField}, ${SF_FIELDS.placementCommPaidField}, ${SF_FIELDS.placementTypeField}, Candidate_Name__c, Candidate__c FROM ${SF_FIELDS.placementObject} WHERE ${SF_FIELDS.placementPaidField} = true`

      if (sinceDate) {
        soql += ` AND LastModifiedDate >= ${sinceDate.toISOString()}`
      }

      const records: Record<string, unknown>[] = []
      const query = conn.query(soql)
      await new Promise<void>((resolve, reject) => {
        query.on('record', (record: Record<string, unknown>) => records.push(record))
        query.on('end', () => resolve())
        query.on('error', (err: Error) => reject(err))
        query.run({ autoFetch: true, maxFetch: 10000 })
      })

      let created = 0
      let updated = 0

      for (const rec of records) {
        const sfId = rec.Id as string
        const nfiValue = Number(rec[SF_FIELDS.placementNfiField] || 0)
        const placementType = String(rec[SF_FIELDS.placementTypeField] || 'PERM').toUpperCase()
        const ownerSfId = rec.OwnerId as string
        const ownerUserId = userMap.get(ownerSfId) || null

        // Resolve account
        let accountId: string | null = null
        const accountRef = rec.Account__r as Record<string, unknown> | null
        if (rec.Account__c && accountRef?.Name) {
          accountId = await this.resolveAccount(rec.Account__c as string, accountRef.Name as string)
        }

        const isClawback = nfiValue < 0

        const data = {
          name: rec.Name as string,
          accountId,
          candidateContactId: (rec.Candidate__c as string) || null,
          candidateName: (rec.Candidate_Name__c as string) || null,
          ownerSalesforceUserId: ownerSfId,
          ownerUserId,
          nfiValue,
          placedDate: rec.Placed_Date__c ? new Date(rec.Placed_Date__c as string) : null,
          invoicedDate: rec.Invoice_Date__c ? new Date(rec.Invoice_Date__c as string) : null,
          paidToAkkar: Boolean(rec[SF_FIELDS.placementPaidField]),
          commissionPaid: Boolean(rec[SF_FIELDS.placementCommPaidField]),
          placementType: placementType === 'CONTRACT' ? 'CONTRACT' as const : 'PERM' as const,
          isClawback,
          lastSyncedAt: new Date(),
        }

        const existing = await prisma.placement.findUnique({ where: { salesforceId: sfId } })
        if (existing) {
          await prisma.placement.update({ where: { salesforceId: sfId }, data })
          updated++
        } else {
          await prisma.placement.create({ data: { ...data, salesforceId: sfId } })
          created++
        }
      }

      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'SUCCESS',
          recordsProcessed: records.length,
          recordsCreated: created,
          recordsUpdated: updated,
          completedAt: new Date(),
        },
      })

      return { processed: records.length, created, updated }
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

  async syncTimesheets(triggeredBy: string, sinceDate?: Date) {
    const syncLog = await prisma.syncLog.create({
      data: { syncType: 'SALESFORCE_TIMESHEETS' as SyncType, triggeredBy },
    })

    try {
      const conn = await this.connect()
      const userMap = await this.buildUserMap()

      let soql = `SELECT Id, Name, Placement__c, Account__c, Account__r.Name, OwnerId, Owner.Email, Week_Ending__c, Gross_Value__c, NFI_Value__c, Approved__c, ${SF_FIELDS.timesheetPaidField}, ${SF_FIELDS.timesheetCommPaidField}, Candidate_Name__c, Candidate__c FROM ${SF_FIELDS.timesheetObject} WHERE ${SF_FIELDS.timesheetPaidField} = true`

      if (sinceDate) {
        soql += ` AND LastModifiedDate >= ${sinceDate.toISOString()}`
      }

      const records: Record<string, unknown>[] = []
      const query = conn.query(soql)
      await new Promise<void>((resolve, reject) => {
        query.on('record', (record: Record<string, unknown>) => records.push(record))
        query.on('end', () => resolve())
        query.on('error', (err: Error) => reject(err))
        query.run({ autoFetch: true, maxFetch: 10000 })
      })

      let created = 0
      let updated = 0

      for (const rec of records) {
        const sfId = rec.Id as string
        const nfiValue = Number(rec.NFI_Value__c || 0)
        const grossValue = Number(rec.Gross_Value__c || 0)
        const ownerSfId = rec.OwnerId as string
        const ownerUserId = userMap.get(ownerSfId) || null

        // Resolve placement link
        let placementId: string | null = null
        if (rec.Placement__c) {
          const pl = await prisma.placement.findUnique({
            where: { salesforceId: rec.Placement__c as string },
            select: { id: true },
          })
          placementId = pl?.id || null
        }

        // Resolve account
        let accountId: string | null = null
        const accountRef = rec.Account__r as Record<string, unknown> | null
        if (rec.Account__c && accountRef?.Name) {
          accountId = await this.resolveAccount(rec.Account__c as string, accountRef.Name as string)
        }

        const isClawback = nfiValue < 0

        const data = {
          name: rec.Name as string,
          placementId,
          candidateContactId: (rec.Candidate__c as string) || null,
          candidateName: (rec.Candidate_Name__c as string) || null,
          accountId,
          ownerSalesforceUserId: ownerSfId,
          ownerUserId,
          weekEnding: rec.Week_Ending__c ? new Date(rec.Week_Ending__c as string) : null,
          grossValue,
          nfiValue,
          approved: Boolean(rec.Approved__c),
          paidToAkkar: Boolean(rec[SF_FIELDS.timesheetPaidField]),
          commissionPaid: Boolean(rec[SF_FIELDS.timesheetCommPaidField]),
          isClawback,
          lastSyncedAt: new Date(),
        }

        const existing = await prisma.timesheet.findUnique({ where: { salesforceId: sfId } })
        if (existing) {
          await prisma.timesheet.update({ where: { salesforceId: sfId }, data })
          updated++
        } else {
          await prisma.timesheet.create({ data: { ...data, salesforceId: sfId } })
          created++
        }
      }

      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'SUCCESS',
          recordsProcessed: records.length,
          recordsCreated: created,
          recordsUpdated: updated,
          completedAt: new Date(),
        },
      })

      return { processed: records.length, created, updated }
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

  // Write Commission_Paid back to Salesforce
  async markCommissionPaidInSF(salesforceId: string, objectType: 'placement' | 'timesheet') {
    const conn = await this.connect()
    const objectName = objectType === 'placement'
      ? SF_FIELDS.placementObject
      : SF_FIELDS.timesheetObject
    const fieldName = objectType === 'placement'
      ? SF_FIELDS.placementCommPaidField
      : SF_FIELDS.timesheetCommPaidField

    await conn.sobject(objectName).update({
      Id: salesforceId,
      [fieldName]: true,
    })
  }
}

export const salesforceService = new SalesforceService()
