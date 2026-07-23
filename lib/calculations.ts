import type { SlabResult } from './types'

/**
 * Rating % thresholds for AC & NAC (max score = 15)
 * Exterior max = 3 — same % logic applies
 */
export const SLABS = [
  { label: '≥86%',       min: 86,  max: 100, penaltyPct: 0    },
  { label: '76–85%',     min: 76,  max: 85,  penaltyPct: 0.05 },
  { label: '66–75%',     min: 66,  max: 75,  penaltyPct: 0.10 },
  { label: '50–65%',     min: 50,  max: 65,  penaltyPct: 0.20 },
  { label: '<50%',       min: 0,   max: 49,  penaltyPct: 1.00 },
]

/** Convert raw score to percentage (out of maxScore) */
export function scorePct(score: number, maxScore: number): number {
  return (score / maxScore) * 100
}

/**
 * Classify a single coach score into a slab index (0-4)
 * 0 = ≥86%, 4 = <50%
 */
export function classifySlab(score: number, maxScore: number): number {
  const pct = scorePct(score, maxScore)
  if (pct >= 86) return 0
  if (pct >= 76) return 1
  if (pct >= 66) return 2
  if (pct >= 50) return 3
  return 4
}

/**
 * Calculate slab counts + penalties for a set of coach scores.
 * rateWithoutGST = the per-coach rate (without GST) for this section.
 * maxScore = 15 for AC/NAC, 3 for Exterior.
 */
export function calcSlabs(
  scores: number[],
  rateWithoutGST: number,
  maxScore: number
): SlabResult {
  const counts = [0, 0, 0, 0, 0]
  for (const s of scores) {
    counts[classifySlab(s, maxScore)]++
  }

  const [c0, c1, c2, c3, c4] = counts
  const p5   = round2(c1 * rateWithoutGST * 0.05)
  const p10  = round2(c2 * rateWithoutGST * 0.10)
  const p20  = round2(c3 * rateWithoutGST * 0.20)
  const p100 = round2(c4 * rateWithoutGST * 1.00)

  return {
    slab86to100:  c0,
    slab76to85:   c1,
    slab66to75:   c2,
    slab50to65:   c3,
    slabBelow50:  c4,
    penaltyNil:   0,
    penalty5pct:  p5,
    penalty10pct: p10,
    penalty20pct: p20,
    penalty100pct: p100,
    totalPenalty: round2(p5 + p10 + p20 + p100),
  }
}

/**
 * Manpower shortfall penalty.
 * penalty = shortfall × 2 × minWages
 * Only applies when deployed < required.
 */
export function calcManpowerPenalty(
  required: number,
  deployed: number,
  minWages: number
): number {
  const shortfall = Math.max(0, required - deployed)
  return shortfall * 2 * minWages
}

/**
 * Rate without GST from rate with GST.
 * Formula: rateWithGST × 100 / (100 + gstPct)
 */
export function rateWithoutGST(rateWithGST: number, gstPct: number): number {
  return round2(rateWithGST * 100 / (100 + gstPct))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
