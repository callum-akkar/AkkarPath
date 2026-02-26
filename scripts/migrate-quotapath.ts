/**
 * QuotaPath → Akkar Commissions Migration Script
 *
 * This script imports historical commission data exported from QuotaPath
 * into the new Akkar Commissions system.
 *
 * Expected CSV format (from QuotaPath export):
 *   - Column headers in first row
 *   - Required columns: email, period, amount, source, status
 *   - Optional columns: gross_value, rate, deal_name, component, note
 *
 * Usage:
 *   npx tsx scripts/migrate-quotapath.ts <path-to-csv>
 *
 * Options:
 *   --dry-run    Preview without writing to database
 *   --period     Only import entries for a specific period (YYYY-MM)
 */

import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const prisma = new PrismaClient()

interface CsvRow {
  email: string
  period: string
  amount: string
  source?: string
  status?: string
  gross_value?: string
  rate?: string
  deal_name?: string
  component?: string
  note?: string
}

function parseCSV(content: string): CsvRow[] {
  const lines = content.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, '_'))
  const rows: CsvRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"/, '').replace(/"$/, ''))
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = values[idx] || ''
    })
    rows.push(row as unknown as CsvRow)
  }

  return rows
}

async function migrate(csvPath: string, dryRun: boolean, filterPeriod?: string) {
  console.log(`\nQuotaPath Migration Script`)
  console.log(`=========================`)
  console.log(`CSV File: ${csvPath}`)
  console.log(`Dry Run: ${dryRun}`)
  if (filterPeriod) console.log(`Filter Period: ${filterPeriod}`)
  console.log('')

  // Read CSV
  const fullPath = resolve(csvPath)
  let content: string
  try {
    content = readFileSync(fullPath, 'utf-8')
  } catch {
    console.error(`Error: Could not read file ${fullPath}`)
    process.exit(1)
  }

  const rows = parseCSV(content)
  console.log(`Found ${rows.length} rows in CSV`)

  // Build user lookup
  const users = await prisma.user.findMany({ select: { id: true, email: true } })
  const userMap = new Map(users.map(u => [u.email.toLowerCase(), u.id]))
  console.log(`Found ${users.length} users in database`)

  let imported = 0
  let skipped = 0
  let errors = 0
  const missingUsers = new Set<string>()

  for (const row of rows) {
    // Filter by period if specified
    if (filterPeriod && row.period !== filterPeriod) {
      skipped++
      continue
    }

    // Find user
    const userId = userMap.get(row.email?.toLowerCase())
    if (!userId) {
      missingUsers.add(row.email)
      skipped++
      continue
    }

    // Parse amounts
    const commissionAmount = parseFloat(row.amount)
    if (isNaN(commissionAmount)) {
      console.warn(`  Warning: Invalid amount "${row.amount}" for ${row.email} in ${row.period}`)
      errors++
      continue
    }

    const grossValue = row.gross_value ? parseFloat(row.gross_value) : 0
    const rate = row.rate ? parseFloat(row.rate) : 0

    // Map status
    let status: 'PENDING' | 'APPROVED' | 'PAID' = 'PENDING'
    if (row.status) {
      const s = row.status.toLowerCase()
      if (s === 'paid' || s === 'completed') status = 'PAID'
      else if (s === 'approved') status = 'APPROVED'
    }

    // Map source type
    let sourceType: 'PLACEMENT' | 'TIMESHEET' = 'PLACEMENT'
    if (row.source) {
      const src = row.source.toLowerCase()
      if (src.includes('timesheet') || src.includes('contract')) sourceType = 'TIMESHEET'
    }

    if (!dryRun) {
      try {
        await prisma.commissionEntry.create({
          data: {
            userId,
            period: row.period,
            commissionAmount,
            grossValue: isNaN(grossValue) ? 0 : grossValue,
            rate: isNaN(rate) ? 0 : rate,
            sourceType,
            status,
            isManualOverride: true,
            manualOverrideNote: `Migrated from QuotaPath${row.note ? ': ' + row.note : ''}${row.deal_name ? ' | Deal: ' + row.deal_name : ''}`,
          },
        })
        imported++
      } catch (err) {
        console.warn(`  Error creating entry for ${row.email}: ${err}`)
        errors++
      }
    } else {
      console.log(`  [DRY RUN] ${row.email} | ${row.period} | ${status} | ${sourceType} | £${commissionAmount.toFixed(2)}`)
      imported++
    }
  }

  // Summary
  console.log('')
  console.log(`Migration Summary`)
  console.log(`-----------------`)
  console.log(`Total rows:     ${rows.length}`)
  console.log(`Imported:       ${imported}`)
  console.log(`Skipped:        ${skipped}`)
  console.log(`Errors:         ${errors}`)

  if (missingUsers.size > 0) {
    console.log('')
    console.log(`Users not found (${missingUsers.size}):`)
    for (const email of missingUsers) {
      console.log(`  - ${email}`)
    }
    console.log('')
    console.log(`Create these users first, then re-run the migration.`)
  }

  if (dryRun) {
    console.log('')
    console.log(`This was a dry run. Run without --dry-run to actually import.`)
  }
}

// Parse CLI args
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const periodIdx = args.indexOf('--period')
const filterPeriod = periodIdx !== -1 ? args[periodIdx + 1] : undefined
const csvPath = args.find(a => !a.startsWith('--') && (periodIdx === -1 || args.indexOf(a) !== periodIdx + 1))

if (!csvPath) {
  console.log('Usage: npx tsx scripts/migrate-quotapath.ts <path-to-csv> [--dry-run] [--period YYYY-MM]')
  process.exit(1)
}

migrate(csvPath, dryRun, filterPeriod)
  .catch(console.error)
  .finally(() => prisma.$disconnect())
