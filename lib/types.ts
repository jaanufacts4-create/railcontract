// ─── Coach types ──────────────────────────────────────────────────────────────
export type CoachCategory = 'AC' | 'NAC' | 'GEN' // GEN = generator/brake van, not attended

export const COACH_TYPE_MAP: Record<string, CoachCategory> = {
  // AC interior
  LWFCZAC: 'AC',
  LWACCN:  'AC',
  LWCBAC:  'AC',
  LWACZAC: 'AC',
  // NAC interior
  GSLRD:   'NAC',
  LWSCN:   'NAC',
  LWS:     'NAC',
  LWSCZAC: 'NAC',
  // Generator / brake vans — not attended
  LWLRRM:  'GEN',
  LWGRD:   'GEN',
}

export function coachCategory(type: string): CoachCategory {
  return COACH_TYPE_MAP[type.toUpperCase()] ?? 'NAC'
}

// ─── DB row shapes ─────────────────────────────────────────────────────────────
export interface TrainComposition {
  train_no: string
  positions: Array<{ position: number; coach_type: string }>
}

export interface Config {
  ac_rate_gst: number      // e.g. 516.99
  nac_rate_gst: number     // e.g. 485.01
  ext_rate_gst: number     // e.g. 165.66
  gst_pct: number          // e.g. 18
  min_wages: number        // e.g. 760
}

export interface Trip {
  id: number
  date: string             // YYYY-MM-DD
  train_no: string
  wl_no: string | null
  acwp: boolean            // true = exterior by ACWP
  supervisor: string
  month_year: string       // e.g. "2026-03"
  created_at: string
}

export interface CoachScore {
  id: number
  trip_id: number
  position: number         // 1-24
  score: number            // 0-15 for AC/NAC, 0-3 for Exterior
}

export interface ManpowerEntry {
  id: number
  trip_id: number
  section: 'AC' | 'NAC'
  required: number
  deployed: number
}

// penalty_type matches column index 1-14 (AF-AS in proforma)
export interface AnnexPenalty {
  id: number
  trip_id: number
  penalty_type: number     // 1-14
  amount: number
}

// ─── Penalty type labels (AF=1 … AS=14) ───────────────────────────────────────
export const PENALTY_LABELS: Record<number, string> = {
  1:  'Work not attended (₹10,000/rake)',
  2:  'Non padlocking (₹500/rake)',
  3:  'Non watering (₹500/coach)',
  4:  'Machines not used (₹500/machine)',
  5:  'Flooding inside coach (₹200)',
  6:  'Garbage on tracks (₹500)',
  7:  'Garbage burning (₹5,000/instance)',
  8:  'Unbranded chemical (₹500/rake)',
  9:  'No chemical used (₹1,000/rake)',
  10: 'Improper uniform (₹100/staff)',
  11: 'Window glass not cleaned (₹100/coach)',
  12: 'Chemical shortage (₹200/day)',
  13: 'Toiletries not supplied in AC (₹200/coach)',
  14: 'Manpower shortage (2× min wages/staff/day)',
}

// ─── Calculation output shapes ────────────────────────────────────────────────
export interface SlabResult {
  slab86to100: number   // count of coaches ≥86%
  slab76to85:  number
  slab66to75:  number
  slab50to65:  number
  slabBelow50: number
  penaltyNil:  number   // always 0
  penalty5pct: number
  penalty10pct: number
  penalty20pct: number
  penalty100pct: number
  totalPenalty: number
}

export interface TripSummaryRow {
  trip: Trip
  acScores:  number[]   // per-coach scores for AC coaches
  nacScores: number[]
  extScores: number[]
  acSlab:    SlabResult
  nacSlab:   SlabResult
  extSlab:   SlabResult
  manpowerPenalty: number
  annexTotal: number
  grandTotal: number    // acSlab + nacSlab + extSlab + manpower + annex
}
