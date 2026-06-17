/**
 * Shared date helpers used across multiple tools.
 *
 * Centralises date arithmetic so each tool does not need its own copy.
 */

/**
 * Returns the Monday of the current week as a YYYY-MM-DD string.
 */
export function getCurrentWeekMonday(): string {
  const now = new Date()
  const day = now.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  return formatISODate(monday)
}

/**
 * Formats a Date as YYYY-MM-DD.
 */
export function formatISODate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Adds N days to a YYYY-MM-DD string and returns YYYY-MM-DD.
 */
export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + n)
  return formatISODate(d)
}

/**
 * Returns true if the YYYY-MM-DD string falls on a Monday.
 */
export function isMonday(dateStr: string): boolean {
  return new Date(`${dateStr}T00:00:00`).getDay() === 1
}

/**
 * Returns true if the date is today or in the past.
 */
export function isTodayOrPast(dateStr: string): boolean {
  const today = formatISODate(new Date())
  return dateStr <= today
}

/**
 * Returns all weekday dates (Mon-Fri) in the range [dateFrom, dateTo].
 * Both bounds are inclusive. Returns YYYY-MM-DD strings.
 */
export function getWeekdaysInRange(dateFrom: string, dateTo: string): string[] {
  const result: string[] = []
  const current = new Date(`${dateFrom}T00:00:00`)
  const end = new Date(`${dateTo}T00:00:00`)

  while (current <= end) {
    const day = current.getDay()
    if (day >= 1 && day <= 5) {
      result.push(formatISODate(current))
    }
    current.setDate(current.getDate() + 1)
  }

  return result
}
