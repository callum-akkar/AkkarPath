/**
 * UK Fiscal Year Utility (April–March)
 *
 * FY format: "FY26/27" means April 2026 – March 2027
 * Quarter format: "FY26/27-Q1" means April–June 2026
 *
 * Q1 = Apr–Jun
 * Q2 = Jul–Sep
 * Q3 = Oct–Dec
 * Q4 = Jan–Mar
 */

/**
 * Returns the fiscal year string for a given date.
 * e.g. "FY26/27" for any date Apr 2026 – Mar 2027
 */
export function getFiscalYear(date: Date): string {
  const month = date.getMonth() // 0-indexed: 0=Jan, 3=Apr
  const year = date.getFullYear()

  // Apr–Dec: FY starts in this calendar year
  // Jan–Mar: FY started in the previous calendar year
  const fyStartYear = month >= 3 ? year : year - 1
  const fyEndYear = fyStartYear + 1

  const startShort = String(fyStartYear).slice(2)
  const endShort = String(fyEndYear).slice(2)
  return `FY${startShort}/${endShort}`
}

/**
 * Returns the quarter (1-4) for a given date.
 * Q1=Apr–Jun, Q2=Jul–Sep, Q3=Oct–Dec, Q4=Jan–Mar
 */
export function getFiscalQuarter(date: Date): number {
  const month = date.getMonth() // 0-indexed
  if (month >= 3 && month <= 5) return 1 // Apr–Jun
  if (month >= 6 && month <= 8) return 2 // Jul–Sep
  if (month >= 9 && month <= 11) return 3 // Oct–Dec
  return 4 // Jan–Mar
}

/**
 * Returns the period string e.g. "FY26/27-Q1" for a given date.
 */
export function getFiscalPeriod(date: Date): string {
  return `${getFiscalYear(date)}-Q${getFiscalQuarter(date)}`
}

/**
 * Returns the 4 period strings for a fiscal year.
 * e.g. getQuartersForFY("FY26/27") => ["FY26/27-Q1", "FY26/27-Q2", "FY26/27-Q3", "FY26/27-Q4"]
 */
export function getQuartersForFY(fy: string): string[] {
  return [1, 2, 3, 4].map(q => `${fy}-Q${q}`)
}

/**
 * Returns start and end dates for a fiscal quarter.
 * e.g. "FY26/27-Q1" => { start: 2026-04-01, end: 2026-06-30 (end of day) }
 * The end date is the first day of the NEXT month (exclusive upper bound).
 */
export function getQuarterDateRange(period: string): { start: Date; end: Date } {
  // Parse "FY26/27-Q1"
  const match = period.match(/^FY(\d{2})\/(\d{2})-Q([1-4])$/)
  if (!match) throw new Error(`Invalid fiscal period format: ${period}`)

  const fyStartYear = 2000 + parseInt(match[1])
  const quarter = parseInt(match[3])

  // Quarter to month mapping (calendar months, 0-indexed for Date constructor)
  // Q1=Apr(3), Q2=Jul(6), Q3=Oct(9), Q4=Jan(0) of next year
  let startMonth: number
  let startYear: number

  switch (quarter) {
    case 1:
      startMonth = 3 // April
      startYear = fyStartYear
      break
    case 2:
      startMonth = 6 // July
      startYear = fyStartYear
      break
    case 3:
      startMonth = 9 // October
      startYear = fyStartYear
      break
    case 4:
      startMonth = 0 // January
      startYear = fyStartYear + 1
      break
    default:
      throw new Error(`Invalid quarter: ${quarter}`)
  }

  const start = new Date(startYear, startMonth, 1)
  const end = new Date(startYear, startMonth + 3, 1) // Exclusive upper bound

  return { start, end }
}

/**
 * Returns the YYYY-MM periods that fall within a fiscal quarter.
 * e.g. "FY26/27-Q1" => ["2026-04", "2026-05", "2026-06"]
 */
export function getMonthsInQuarter(period: string): string[] {
  const { start } = getQuarterDateRange(period)
  const months: string[] = []
  for (let i = 0; i < 3; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

/**
 * Returns a human-readable label for a quarter.
 * e.g. "Q1 (Apr–Jun)"
 */
export function getQuarterLabel(quarter: number): string {
  const labels: Record<number, string> = {
    1: 'Q1 (Apr–Jun)',
    2: 'Q2 (Jul–Sep)',
    3: 'Q3 (Oct–Dec)',
    4: 'Q4 (Jan–Mar)',
  }
  return labels[quarter] || `Q${quarter}`
}

/**
 * Parse a fiscal year string to get the start calendar year.
 * e.g. "FY26/27" => 2026
 */
export function parseFYStartYear(fy: string): number {
  const match = fy.match(/^FY(\d{2})\/(\d{2})$/)
  if (!match) throw new Error(`Invalid fiscal year format: ${fy}`)
  return 2000 + parseInt(match[1])
}

/**
 * Generate a list of fiscal year options for selectors.
 * Returns fiscal years around the current date.
 */
export function getFiscalYearOptions(count: number = 5): string[] {
  const now = new Date()
  const currentFY = getFiscalYear(now)
  const currentStart = parseFYStartYear(currentFY)

  const options: string[] = []
  for (let i = -1; i < count - 1; i++) {
    const y = currentStart + i
    const startShort = String(y).slice(2)
    const endShort = String(y + 1).slice(2)
    options.push(`FY${startShort}/${endShort}`)
  }
  return options
}
