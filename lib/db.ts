import { createClient } from '@libsql/client'

// Local dev: uses a SQLite file (no Turso account needed).
// Production: set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN in .env.local / Vercel env.
const url       = process.env.TURSO_DATABASE_URL ?? 'file:./dev.db'
const authToken = process.env.TURSO_AUTH_TOKEN   ?? undefined

export const db = createClient({ url, authToken })

// Auto-migrate on first use — no manual script needed
let _migrated        = false
let _scheduleEnsured = false
let _secMigrated     = false
let _loaMigrated     = false
let _billingMigrated = false
export async function ensureDB() {
  if (!_migrated) {
    await migrate()
    _migrated = true
  }
  if (!_scheduleEnsured) {
    await ensureSchedule()
    _scheduleEnsured = true
  }
  if (!_secMigrated) {
    await migrateSecondary()
    _secMigrated = true
  }
  if (!_loaMigrated) {
    await migrateLOA()
    _loaMigrated = true
  }
  if (!_billingMigrated) {
    await migrateBillingCumulative()
    _billingMigrated = true
  }
}

/** Idempotent — creates train_schedule table + seeds data if empty. Runs once per process. */
async function ensureSchedule() {
  await db.execute(`CREATE TABLE IF NOT EXISTS train_schedule (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    train_no  TEXT    NOT NULL UNIQUE,
    days      TEXT    NOT NULL DEFAULT '[]',
    ac_count  INTEGER NOT NULL DEFAULT 0,
    nac_count INTEGER NOT NULL DEFAULT 0
  )`)

  const { rows } = await db.execute('SELECT COUNT(*) as cnt FROM train_schedule')
  // libSQL may return BigInt — use Number() to be safe
  if (Number(rows[0].cnt) > 0) return  // already seeded

  const SEED = [
    ['12408',    '["Friday"]',                                                       0,  22],
    ['12484',    '["Saturday"]',                                                     9,  13],
    ['14618',    '["Daily"]',                                                        0,  19],
    ['12204',    '["Tuesday","Friday","Saturday"]',                                 20,   2],
    ['12422',    '["Monday"]',                                                       4,  15],
    ['14616',    '["Friday"]',                                                       4,  15],
    ['14632',    '["Sunday","Monday","Wednesday","Thursday"]',                       2,  16],
    ['14674/50', '["Daily"]',                                                        9,  13],
    ['4652',     '["Sunday","Tuesday","Thursday"]',                                  9,   8],
    ['4654',     '["Tuesday"]',                                                      9,   8],
    ['22488',    '["Monday","Tuesday","Wednesday","Thursday","Friday","Sunday"]',    16,   0],
    ['12054',    '["Sunday","Tuesday","Thursday"]',                                  3,  11],
    ['14680',    '["Monday","Tuesday","Thursday","Friday"]',                         2,  18],
    ['14604',    '["Wednesday"]',                                                    0,  22],
    ['22424',    '["Sunday"]',                                                       0,  22],
    ['54613',    '["Daily"]',                                                        0,   9],
    ['54611',    '["Daily"]',                                                        0,   9],
    ['14628',    '["Saturday"]',                                                     0,  22],
  ] as const

  for (const [train_no, days, ac, nac] of SEED) {
    await db.execute({
      sql:  'INSERT OR IGNORE INTO train_schedule (train_no, days, ac_count, nac_count) VALUES (?,?,?,?)',
      args: [train_no, days, ac, nac],
    })
  }
}

/** Run once to create all tables. Call via `npm run db:migrate` */
export async function migrate() {
  await db.executeMultiple(`
    -- ── Config (key/value store) ───────────────────────────────────────
    CREATE TABLE IF NOT EXISTS config (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- seed defaults
    INSERT OR IGNORE INTO config (key, value) VALUES
      ('ac_rate_gst',  '516.99'),
      ('nac_rate_gst', '485.01'),
      ('ext_rate_gst', '165.66'),
      ('gst_pct',      '18'),
      ('min_wages',    '760');

    -- ── Train master ───────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS train_master (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      train_no   TEXT    NOT NULL,
      position   INTEGER NOT NULL,       -- 1 to 24
      coach_type TEXT    NOT NULL,       -- LWFCZAC, GSLRD, etc.
      UNIQUE(train_no, position)
    );

    -- ── Trips ──────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS trips (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      date       TEXT    NOT NULL,       -- YYYY-MM-DD
      train_no   TEXT    NOT NULL,
      wl_no      TEXT,
      acwp       INTEGER NOT NULL DEFAULT 0,  -- 0=No, 1=Yes
      supervisor TEXT    NOT NULL DEFAULT '',
      month_year TEXT    NOT NULL,       -- YYYY-MM
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ── Coach scores ───────────────────────────────────────────────────
    -- One row per (trip, coach position). score = rating entered in proforma.
    CREATE TABLE IF NOT EXISTS coach_scores (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id  INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,         -- 1-24
      score    INTEGER NOT NULL DEFAULT 0
    );

    -- ── Manpower ───────────────────────────────────────────────────────
    -- One row per trip per section (AC / NAC)
    CREATE TABLE IF NOT EXISTS manpower (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id  INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      section  TEXT    NOT NULL,         -- 'AC' or 'NAC'
      required INTEGER NOT NULL DEFAULT 0,
      deployed INTEGER NOT NULL DEFAULT 0
    );

    -- ── Annex penalties (Annex A2 back-side, types 1-14) ──────────────
    CREATE TABLE IF NOT EXISTS annex_penalties (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id      INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      penalty_type INTEGER NOT NULL,     -- 1 to 14
      amount       REAL    NOT NULL DEFAULT 0
    );

    -- ── Intensive cleaning scores ───────────────────────────────────────
    -- Interior score (max 18) + exterior score (max 3) stored separately
    CREATE TABLE IF NOT EXISTS intensive_scores (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id    INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      position   INTEGER NOT NULL,            -- 1-24 (actual train position)
      coach_type TEXT    NOT NULL DEFAULT '', -- original type for AC/NAC classification
      score      INTEGER NOT NULL DEFAULT 0, -- interior: 0-18 (c1×2+c2+c3+c4+c5)
      ext_score  INTEGER NOT NULL DEFAULT 0  -- exterior: 0-3
    );

    -- ── Train schedule ─────────────────────────────────────────────────
    -- days stored as JSON array e.g. ["Monday","Friday"] or ["Daily"]
    CREATE TABLE IF NOT EXISTS train_schedule (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      train_no  TEXT    NOT NULL UNIQUE,
      days      TEXT    NOT NULL DEFAULT '[]',
      ac_count  INTEGER NOT NULL DEFAULT 0,
      nac_count INTEGER NOT NULL DEFAULT 0
    );

    -- Seed schedule data
    INSERT OR IGNORE INTO train_schedule (train_no, days, ac_count, nac_count) VALUES
      ('12408',    '["Friday"]', 0, 22),
      ('12484',    '["Saturday"]', 9, 13),
      ('14618',    '["Daily"]', 0, 19),
      ('12204',    '["Tuesday","Friday","Saturday"]', 20, 2),
      ('12422',    '["Monday"]', 4, 15),
      ('14616',    '["Friday"]', 4, 15),
      ('14632',    '["Sunday","Monday","Wednesday","Thursday"]', 2, 16),
      ('14674/50', '["Daily"]', 9, 13),
      ('4652',     '["Sunday","Tuesday","Thursday"]', 9, 8),
      ('4654',     '["Tuesday"]', 9, 8),
      ('22488',    '["Monday","Tuesday","Wednesday","Thursday","Friday","Sunday"]', 16, 0),
      ('12054',    '["Sunday","Tuesday","Thursday"]', 3, 11),
      ('14680',    '["Monday","Tuesday","Thursday","Friday"]', 2, 18),
      ('14604',    '["Wednesday"]', 0, 22),
      ('22424',    '["Sunday"]', 0, 22),
      ('54613',    '["Daily"]', 0, 9),
      ('54611',    '["Daily"]', 0, 9),
      ('14628',    '["Saturday"]', 0, 22);
  `)

  // Safe column addition for existing DBs that have intensive_scores without ext_score
  try {
    await db.execute('ALTER TABLE intensive_scores ADD COLUMN ext_score INTEGER NOT NULL DEFAULT 0')
  } catch { /* column already exists — ignore */ }
}

/** ─── Secondary Bill (M/s Dynamic Services) ─────────────────────────── */
async function migrateSecondary() {
  await db.executeMultiple(`
    -- Secondary config defaults
    INSERT OR IGNORE INTO config (key, value) VALUES
      ('sec_rate_per_coach',          '322.49'),
      ('sec_rate_per_coach_exterior', '144.28'),
      ('sec_min_wages',               '760');

    -- Users table (multi-user support)
    CREATE TABLE IF NOT EXISTS users (
      username     TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      role         TEXT NOT NULL DEFAULT 'user',
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Seed default super admin (admin / Admin@1234)
    INSERT OR IGNORE INTO users (username, password_hash, role) VALUES
      ('admin', 'c5179c7a6f666319b5fb4bea7e9589eb74100c0d7dbe85d4b2a0b63db5660f44', 'admin');

    -- OBHS monthly summary (extracted from uploaded Excel)
    CREATE TABLE IF NOT EXISTS obhs_monthly (
      month_year       TEXT PRIMARY KEY,  -- YYYY-MM
      ac_obhs_hrs      REAL NOT NULL DEFAULT 0,
      nac_obhs_hrs     REAL NOT NULL DEFAULT 0,
      vb_obhs_hrs      REAL NOT NULL DEFAULT 0,
      garibrath_obhs_hrs REAL NOT NULL DEFAULT 0,
      ehk_hrs          REAL NOT NULL DEFAULT 0,
      raw_json         TEXT,              -- full train-wise breakdown JSON
      uploaded_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- LOA quantities (from Awarded Qty sheet — editable)
    CREATE TABLE IF NOT EXISTS loa_quantities (
      item_no     INTEGER PRIMARY KEY,  -- 1-9
      item_name   TEXT NOT NULL,
      unit        TEXT NOT NULL,
      rate_gst    REAL NOT NULL DEFAULT 0,
      loa_qty     REAL NOT NULL DEFAULT 0
    );

    -- Secondary train master
    CREATE TABLE IF NOT EXISTS sec_trains (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      train_no     TEXT    NOT NULL UNIQUE,
      days         TEXT    NOT NULL DEFAULT '[]',
      ac_count     INTEGER NOT NULL DEFAULT 0,
      nac_count    INTEGER NOT NULL DEFAULT 0,
      req_manpower INTEGER NOT NULL DEFAULT 0
    );

    -- Secondary trips (one row per train per date per cleaning type)
    CREATE TABLE IF NOT EXISTS sec_trips (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      date          TEXT    NOT NULL,       -- YYYY-MM-DD
      train_no      TEXT    NOT NULL,
      cleaning_type TEXT    NOT NULL,       -- 'Interior' | 'Exterior'
      coach_count   INTEGER NOT NULL DEFAULT 0,
      req_manpower  INTEGER NOT NULL DEFAULT 0,
      avail_manpower INTEGER NOT NULL DEFAULT 0,
      washing_line  TEXT    NOT NULL DEFAULT '',
      is_acwp       INTEGER NOT NULL DEFAULT 0,  -- 1 = attended by ACWP
      month_year    TEXT    NOT NULL,       -- YYYY-MM
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Per-coach ratings for Secondary trips
    -- Interior: 4 criteria per coach (0-3 each, max 12/coach)
    -- Exterior: 1 criterion per coach (0-3, max 3/coach)
    CREATE TABLE IF NOT EXISTS sec_coach_ratings (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id    INTEGER NOT NULL REFERENCES sec_trips(id) ON DELETE CASCADE,
      coach_slot INTEGER NOT NULL,          -- 1-24
      criterion  INTEGER NOT NULL DEFAULT 1,-- 1-4 for Interior, 1 for Exterior
      rating     INTEGER NOT NULL DEFAULT 0 -- 0-3
    );

    -- Annexure B penalties per Secondary trip (11 types, slots 1-4 & 6-12)
    CREATE TABLE IF NOT EXISTS sec_annex_b (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id      INTEGER NOT NULL REFERENCES sec_trips(id) ON DELETE CASCADE,
      penalty_slot INTEGER NOT NULL,        -- 1,2,3,4,6,7,8,9,10,11,12
      amount       REAL    NOT NULL DEFAULT 0
    );
  `)

  // Add criterion column if missing (idempotent)
  try {
    await db.execute('ALTER TABLE sec_coach_ratings ADD COLUMN criterion INTEGER NOT NULL DEFAULT 1')
  } catch { /* already exists */ }

  // Seed secondary trains if empty
  const { rows } = await db.execute('SELECT COUNT(*) as cnt FROM sec_trains')
  if (Number(rows[0].cnt) > 0) return

  const SEC_TRAINS = [
    ['11058', '["Daily"]',                               10,  7, 7],
    ['12716', '["Daily"]',                               11, 10, 8],
    ['15934', '["Friday"]',                              12,  9, 8],
    ['18238', '["Daily"]',                               10, 11, 8],
    ['20808', '["Wednesday","Saturday","Sunday"]',        8, 12, 7],
  ] as const

  for (const [train_no, days, ac, nac, req_mp] of SEC_TRAINS) {
    await db.execute({
      sql:  'INSERT OR IGNORE INTO sec_trains (train_no, days, ac_count, nac_count, req_manpower) VALUES (?,?,?,?,?)',
      args: [train_no, days, ac, nac, req_mp],
    })
  }
}

/** ─── LOA Quantities & OBHS ──────────────────────────────────────────── */
async function migrateLOA() {
  // Tables already created in migrateSecondary — just seed LOA if empty
  const { rows } = await db.execute('SELECT COUNT(*) as cnt FROM loa_quantities')
  if (Number(rows[0].cnt) > 0) return

  const LOA_ITEMS = [
    [1, 'Mechanized coach cleaning of Primary Trains (AC)',                              'Coaches', 516.99,  52596],
    [2, 'Mechanized coach cleaning of Primary Trains (NAC)',                             'Coaches', 485.01, 181164],
    [3, 'Mechanized External coach cleaning of Primary Trains (AC & NAC)',               'Coaches', 165.66,  26298],
    [4, 'Mechanized coach cleaning of VB coaches',                                       'Coaches',1104.99,  23376],
    [5, 'OBHS in AC with Toiletries in coaches',                                         'Hours',    83.64, 688834],
    [6, 'OBHS in NAC with Handwash in coaches',                                          'Hours',    81.33, 726816],
    [7, 'OBHS in AC with Toiletries in VB coaches',                                      'Hours',    81.33, 119890],
    [8, 'OBHS in AC with Toiletries in Garibrath Coaches',                               'Hours',    81.33, 399113],
    [9, 'Supervision/ monitoring of OBHS staff in all rakes of trains',                  'Hours',    90.77, 390605],
  ] as const

  for (const [item_no, item_name, unit, rate_gst, loa_qty] of LOA_ITEMS) {
    await db.execute({
      sql:  'INSERT OR IGNORE INTO loa_quantities (item_no, item_name, unit, rate_gst, loa_qty) VALUES (?,?,?,?,?)',
      args: [item_no, item_name, unit, rate_gst, loa_qty],
    })
  }
}

/** ─── Billing cumulative (running upto-date totals) ─────────────────────── */
async function migrateBillingCumulative() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS billing_cumulative (
      item_no         INTEGER PRIMARY KEY,
      upto_qty        REAL NOT NULL DEFAULT 0,
      upto_payment    REAL NOT NULL DEFAULT 0
    )
  `)
  // Seed 9 rows if empty
  const { rows } = await db.execute('SELECT COUNT(*) as cnt FROM billing_cumulative')
  if (Number(rows[0].cnt) > 0) return
  for (let i = 1; i <= 9; i++) {
    await db.execute({
      sql:  'INSERT OR IGNORE INTO billing_cumulative (item_no, upto_qty, upto_payment) VALUES (?,0,0)',
      args: [i],
    })
  }
}
