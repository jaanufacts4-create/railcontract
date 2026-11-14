/**
 * Helper: find the minimum daily wages applicable for a given trip date,
 * using the period-wise config stored as `sec_wage_periods` JSON.
 *
 * Config format (stored in `config` table as `sec_wage_periods`):
 *   [{"from":"2025-11","to":"2026-03","rate":760},{"from":"2026-04","rate":820}]
 * - `from` and `to` are YYYY-MM strings (inclusive)
 * - missing / empty `to` means open-ended (ongoing)
 * - falls back to `sec_min_wages` scalar, then 760 if neither is set
 */

type WagePeriod = { from: string; to?: string; rate: number }

export function getWageForDate(
  tripDate: string,
  periods: WagePeriod[],
  fallback = 760,
): number {
  const ym = tripDate.slice(0, 7) // "YYYY-MM"
  for (const p of periods) {
    if (ym >= p.from && (!p.to || ym <= p.to)) return Number(p.rate)
  }
  return fallback
}

/**
 * Load wage rate for `tripDate` from the DB config rows.
 * Pass the result of:
 *   db.execute("SELECT key, value FROM config WHERE key IN ('sec_min_wages','sec_wage_periods')")
 */
export function resolveWageFromConfig(
  tripDate: string,
  cfgRows: { key: unknown; value: unknown }[],
  fallback = 760,
): number {
  const map: Record<string, string> = {}
  for (const r of cfgRows) map[r.key as string] = r.value as string

  let base = Number(map.sec_min_wages) || fallback

  if (map.sec_wage_periods) {
    try {
      const periods: WagePeriod[] = JSON.parse(map.sec_wage_periods)
      if (periods.length > 0) {
        base = getWageForDate(tripDate, periods, base)
      }
    } catch { /* ignore malformed JSON, use base */ }
  }

  return base
}
