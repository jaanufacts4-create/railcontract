import { createClient } from '@libsql/client'

// Local dev: uses a SQLite file (no Turso account needed).
// Production: set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN in .env.local / Vercel env.
const url       = process.env.TURSO_DATABASE_URL ?? 'file:./dev.db'
const authToken = process.env.TURSO_AUTH_TOKEN   ?? undefined

export const db = createClient({ url, authToken })

// Auto-migrate on first use — no manual script needed
let _migrated           = false
let _scheduleEnsured    = false
let _secMigrated        = false
let _loaMigrated        = false
let _billingMigrated    = false
let _secBillingMigrated = false
let _nirmalMigrated     = false
let _nirmalV2Migrated   = false
let _obhsScheduleMigrated = false
let _nirmalObhsMigrated    = false
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
  if (!_secBillingMigrated) {
    await migrateSecondaryBilling()
    _secBillingMigrated = true
  }
  if (!_nirmalMigrated) {
    await migrateNirmal()
    _nirmalMigrated = true
  }
  if (!_nirmalV2Migrated) {
    await migrateNirmalV2()
    _nirmalV2Migrated = true
  }
  await migrateMonthlyBills()
  if (!_obhsScheduleMigrated) {
    await migrateOBHSSchedule()
    _obhsScheduleMigrated = true
  }
  if (!_nirmalObhsMigrated) {
    await migrateNirmalOBHS()
    _nirmalObhsMigrated = true
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

    -- Seed default super admin (admin / Admin@1234) — bcrypt hash
    INSERT OR IGNORE INTO users (username, password_hash, role) VALUES
      ('admin', '$2b$12$hzeHmVGoaOnori1Sh1kE4.TZHWy2qfrbAVORtEmvcq1B/1Zi61TZ6', 'admin');

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

/** ─── Monthly bills summary ─────────────────────────────────────────────── */
async function migrateMonthlyBills() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS monthly_bills (
      month_year        TEXT PRIMARY KEY,
      gross_amount      REAL NOT NULL DEFAULT 0,
      penalty           REAL NOT NULL DEFAULT 0,
      penalty_breakdown TEXT,
      net_amount        REAL NOT NULL DEFAULT 0,
      generated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
}

/** ─── Secondary contract LOA + monthly bills ────────────────────────────── */
async function migrateSecondaryBilling() {
  // LOA quantities for secondary (M/s Dynamic Services) — user can edit via UI
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sec_loa_quantities (
      item_no   INTEGER PRIMARY KEY,
      item_name TEXT    NOT NULL,
      unit      TEXT    NOT NULL,
      rate_gst  REAL    NOT NULL DEFAULT 0,
      loa_qty   REAL    NOT NULL DEFAULT 0
    )
  `)

  const { rows: loaCheck } = await db.execute('SELECT COUNT(*) as cnt FROM sec_loa_quantities')
  if (Number(loaCheck[0].cnt) === 0) {
    // Seed with placeholder LOA — user updates these via sec/loa page
    const SEC_LOA = [
      [1, 'Mechanized coach cleaning - Interior',  'Coaches', 322.49, 0],
      [2, 'Mechanized coach cleaning - Exterior',  'Coaches', 144.28, 0],
    ]
    for (const [item_no, item_name, unit, rate_gst, loa_qty] of SEC_LOA) {
      await db.execute({
        sql:  'INSERT OR IGNORE INTO sec_loa_quantities (item_no, item_name, unit, rate_gst, loa_qty) VALUES (?,?,?,?,?)',
        args: [item_no, item_name, unit, rate_gst, loa_qty],
      })
    }
  }

  // Monthly bills for secondary contract
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sec_monthly_bills (
      month_year        TEXT PRIMARY KEY,
      gross_amount      REAL NOT NULL DEFAULT 0,
      penalty           REAL NOT NULL DEFAULT 0,
      penalty_breakdown TEXT,
      net_amount        REAL NOT NULL DEFAULT 0,
      generated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Cumulative for secondary
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sec_billing_cumulative (
      item_no      INTEGER PRIMARY KEY,
      upto_qty     REAL NOT NULL DEFAULT 0,
      upto_payment REAL NOT NULL DEFAULT 0
    )
  `)
  const { rows: cumCheck } = await db.execute('SELECT COUNT(*) as cnt FROM sec_billing_cumulative')
  if (Number(cumCheck[0].cnt) === 0) {
    for (let i = 1; i <= 2; i++) {
      await db.execute({
        sql:  'INSERT OR IGNORE INTO sec_billing_cumulative (item_no, upto_qty, upto_payment) VALUES (?,0,0)',
        args: [i],
      })
    }
  }
}

/** ─── Nirmal Facility Management Service ────────────────────────────────── */
async function migrateNirmal() {
  // Config defaults for Nirmal rate
  await db.execute(`
    INSERT OR IGNORE INTO config (key, value) VALUES ('nirmal_rate_gst', '569')
  `)

  // LOA for Nirmal (2 items: AC + NAC at same rate)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS nirmal_loa_quantities (
      item_no   INTEGER PRIMARY KEY,
      item_name TEXT    NOT NULL,
      unit      TEXT    NOT NULL,
      rate_gst  REAL    NOT NULL DEFAULT 0,
      loa_qty   REAL    NOT NULL DEFAULT 0
    )
  `)

  const { rows: loaCheck } = await db.execute('SELECT COUNT(*) as cnt FROM nirmal_loa_quantities')
  if (Number(loaCheck[0].cnt) === 0) {
    const NIRMAL_LOA = [
      [1, 'Mechanized Coach Cleaning - AC Coaches',  'Coaches', 569, 0],
      [2, 'Mechanized Coach Cleaning - NAC Coaches', 'Coaches', 569, 0],
    ]
    for (const [item_no, item_name, unit, rate_gst, loa_qty] of NIRMAL_LOA) {
      await db.execute({
        sql:  'INSERT OR IGNORE INTO nirmal_loa_quantities (item_no, item_name, unit, rate_gst, loa_qty) VALUES (?,?,?,?,?)',
        args: [item_no, item_name, unit, rate_gst, loa_qty],
      })
    }
  }

  // Cumulative upto-date totals
  await db.execute(`
    CREATE TABLE IF NOT EXISTS nirmal_billing_cumulative (
      item_no      INTEGER PRIMARY KEY,
      upto_qty     REAL NOT NULL DEFAULT 0,
      upto_payment REAL NOT NULL DEFAULT 0
    )
  `)
  const { rows: cumCheck } = await db.execute('SELECT COUNT(*) as cnt FROM nirmal_billing_cumulative')
  if (Number(cumCheck[0].cnt) === 0) {
    for (let i = 1; i <= 2; i++) {
      await db.execute({
        sql:  'INSERT OR IGNORE INTO nirmal_billing_cumulative (item_no, upto_qty, upto_payment) VALUES (?,0,0)',
        args: [i],
      })
    }
  }

  // Monthly bills log
  await db.execute(`
    CREATE TABLE IF NOT EXISTS nirmal_monthly_bills (
      month_year   TEXT PRIMARY KEY,
      gross_amount REAL NOT NULL DEFAULT 0,
      net_amount   REAL NOT NULL DEFAULT 0,
      generated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
}

/** ─── Nirmal V2 — trips, scores, OBHS, extended LOA ────────────────────── */
async function migrateNirmalV2() {
  // Trips table for Nirmal
  await db.execute(`
    CREATE TABLE IF NOT EXISTS nirmal_trips (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      date       TEXT    NOT NULL,
      train_no   TEXT    NOT NULL,
      wl_no      TEXT,
      supervisor TEXT    NOT NULL DEFAULT '',
      month_year TEXT    NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Coach scores (reuses train_master for coach_type lookup)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS nirmal_coach_scores (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id  INTEGER NOT NULL REFERENCES nirmal_trips(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      score    INTEGER NOT NULL DEFAULT 0
    )
  `)

  // Intensive cleaning scores
  await db.execute(`
    CREATE TABLE IF NOT EXISTS nirmal_intensive_scores (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id    INTEGER NOT NULL REFERENCES nirmal_trips(id) ON DELETE CASCADE,
      position   INTEGER NOT NULL,
      coach_type TEXT    NOT NULL DEFAULT '',
      score      INTEGER NOT NULL DEFAULT 0,
      ext_score  INTEGER NOT NULL DEFAULT 0
    )
  `)

  // Manpower
  await db.execute(`
    CREATE TABLE IF NOT EXISTS nirmal_manpower (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id  INTEGER NOT NULL REFERENCES nirmal_trips(id) ON DELETE CASCADE,
      section  TEXT    NOT NULL,
      required INTEGER NOT NULL DEFAULT 0,
      deployed INTEGER NOT NULL DEFAULT 0
    )
  `)

  // Annex penalties
  await db.execute(`
    CREATE TABLE IF NOT EXISTS nirmal_annex_penalties (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id      INTEGER NOT NULL REFERENCES nirmal_trips(id) ON DELETE CASCADE,
      penalty_type INTEGER NOT NULL,
      amount       REAL    NOT NULL DEFAULT 0
    )
  `)

  // OBHS monthly (same structure as Primary)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS nirmal_obhs_monthly (
      month_year          TEXT PRIMARY KEY,
      ac_obhs_hrs         REAL NOT NULL DEFAULT 0,
      nac_obhs_hrs        REAL NOT NULL DEFAULT 0,
      vb_obhs_hrs         REAL NOT NULL DEFAULT 0,
      garibrath_obhs_hrs  REAL NOT NULL DEFAULT 0,
      ehk_hrs             REAL NOT NULL DEFAULT 0,
      raw_json            TEXT,
      uploaded_at         TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Nirmal-specific train schedule (separate from Primary)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS nirmal_train_schedule (
      train_no  TEXT PRIMARY KEY,
      days      TEXT NOT NULL,
      ac_count  INTEGER DEFAULT 0,
      nac_count INTEGER DEFAULT 0
    )
  `)

  // Extend nirmal_loa_quantities to 7 items (add OBHS items if not present)
  const { rows: loaRows } = await db.execute('SELECT COUNT(*) as cnt FROM nirmal_loa_quantities')
  if (Number(loaRows[0].cnt) < 7) {
    const NIRMAL_LOA_EXTRA = [
      [3, 'OBHS in AC with Toiletries in coaches',                          'Hours',  0, 0],
      [4, 'OBHS in NAC with Handwash in coaches',                           'Hours',  0, 0],
      [5, 'OBHS in AC with Toiletries in VB coaches',                       'Hours',  0, 0],
      [6, 'OBHS in AC with Toiletries in Garibrath Coaches',                'Hours',  0, 0],
      [7, 'Supervision/ monitoring of OBHS staff in all rakes of trains',   'Hours',  0, 0],
    ]
    for (const [item_no, item_name, unit, rate_gst, loa_qty] of NIRMAL_LOA_EXTRA) {
      await db.execute({
        sql:  'INSERT OR IGNORE INTO nirmal_loa_quantities (item_no, item_name, unit, rate_gst, loa_qty) VALUES (?,?,?,?,?)',
        args: [item_no, item_name, unit, rate_gst, loa_qty],
      })
    }
  }

  // Extend nirmal_billing_cumulative to 7 rows
  const { rows: cumRows } = await db.execute('SELECT COUNT(*) as cnt FROM nirmal_billing_cumulative')
  if (Number(cumRows[0].cnt) < 7) {
    for (let i = 3; i <= 7; i++) {
      await db.execute({
        sql:  'INSERT OR IGNORE INTO nirmal_billing_cumulative (item_no, upto_qty, upto_payment) VALUES (?,0,0)',
        args: [i],
      })
    }
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

/** ─── OBHS Schedule — per-trip entry ───────────────────────────────────── */
async function migrateOBHSSchedule() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS obhs_trains (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      train_no    TEXT    NOT NULL UNIQUE,
      days        TEXT    NOT NULL DEFAULT '[]',
      ehk_ws      INTEGER NOT NULL DEFAULT 1,
      ac_ws       INTEGER NOT NULL DEFAULT 0,
      nac_ws      INTEGER NOT NULL DEFAULT 0,
      journey_hrs REAL    NOT NULL DEFAULT 0,
      ehk_rate    REAL    NOT NULL DEFAULT 76.92,
      ac_rate     REAL    NOT NULL DEFAULT 70.88,
      nac_rate    REAL    NOT NULL DEFAULT 68.92,
      min_wages   REAL    NOT NULL DEFAULT 781
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS obhs_entries (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      train_no    TEXT    NOT NULL,
      date        TEXT    NOT NULL,
      month_year  TEXT    NOT NULL,
      ehk_present INTEGER NOT NULL DEFAULT 1,
      ac_short    INTEGER NOT NULL DEFAULT 0,
      nac_short   INTEGER NOT NULL DEFAULT 0,
      psi_pct     REAL    NOT NULL DEFAULT 0,
      w_penalty   REAL    NOT NULL DEFAULT 0,
      x_penalty   REAL    NOT NULL DEFAULT 0,
      aa_penalty  REAL    NOT NULL DEFAULT 0,
      ab_penalty  REAL    NOT NULL DEFAULT 0,
      ac_penalty  REAL    NOT NULL DEFAULT 0,
      ad_penalty  REAL    NOT NULL DEFAULT 0,
      ae_penalty  REAL    NOT NULL DEFAULT 0,
      af_penalty  REAL    NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(train_no, date)
    )
  `)

  const { rows } = await db.execute('SELECT COUNT(*) as cnt FROM obhs_trains')
  if (Number(rows[0].cnt) > 0) return

  const TRAINS = [
    ['12204/03', '["Wednesday","Saturday","Sunday"]',                              1, 10, 0, 63.92,  76.92, 70.88,  0    ],
    ['22488/87', '["Monday","Tuesday","Wednesday","Thursday","Sunday"]',           1,  8, 0, 12.00,  76.92, 70.88,  0    ],
    ['04652',    '["Wednesday","Friday","Sunday"]',                               1,  3, 2, 68.58,  76.92, 70.88, 68.92 ],
    ['14616',    '["Saturday"]',                                                   1,  1, 3, 31.50,  76.92, 70.88, 68.92 ],
    ['12484',    '["Sunday"]',                                                     1,  3, 2, 114.58, 76.92, 70.88, 68.92 ],
    ['12422',    '["Monday"]',                                                     1,  1, 3, 63.67,  76.92, 70.88, 68.92 ],
    ['04654',    '["Wednesday"]',                                                  1,  3, 2, 67.67,  76.92, 70.88, 68.92 ],
    ['12054',    '["Monday","Tuesday","Wednesday","Friday","Saturday","Sunday"]',  1,  1, 4, 16.00,  76.92, 70.88, 68.92 ],
    ['14680',    '["Daily"]',                                                      1,  1, 2, 65.67,  76.92, 70.88, 68.92 ],
    ['14674/50', '["Daily"]',                                                      1,  3, 2, 70.92,  76.92, 70.88, 68.92 ],
    ['14628',    '["Saturday"]',                                                   1,  0, 6, 75.00,  76.92,  0,    68.92 ],
  ]

  for (const [train_no, days, ehk_ws, ac_ws, nac_ws, journey_hrs, ehk_rate, ac_rate, nac_rate] of TRAINS) {
    await db.execute({
      sql:  'INSERT OR IGNORE INTO obhs_trains (train_no, days, ehk_ws, ac_ws, nac_ws, journey_hrs, ehk_rate, ac_rate, nac_rate) VALUES (?,?,?,?,?,?,?,?,?)',
      args: [train_no, days, ehk_ws, ac_ws, nac_ws, journey_hrs, ehk_rate, ac_rate, nac_rate],
    })
  }
}

async function migrateNirmalOBHS() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS nirmal_obhs_trains (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      train_no    TEXT    NOT NULL UNIQUE,
      days        TEXT    NOT NULL DEFAULT '[]',
      ehk_ws      INTEGER NOT NULL DEFAULT 1,
      ac_ws       INTEGER NOT NULL DEFAULT 0,
      nac_ws      INTEGER NOT NULL DEFAULT 0,
      journey_hrs REAL    NOT NULL DEFAULT 0,
      ehk_rate    REAL    NOT NULL DEFAULT 76.92,
      ac_rate     REAL    NOT NULL DEFAULT 70.88,
      nac_rate    REAL    NOT NULL DEFAULT 68.92,
      min_wages   REAL    NOT NULL DEFAULT 781
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS nirmal_obhs_entries (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      train_no    TEXT    NOT NULL,
      date        TEXT    NOT NULL,
      month_year  TEXT    NOT NULL,
      ehk_present INTEGER NOT NULL DEFAULT 1,
      ac_short    INTEGER NOT NULL DEFAULT 0,
      nac_short   INTEGER NOT NULL DEFAULT 0,
      psi_pct     REAL    NOT NULL DEFAULT 0,
      w_penalty   REAL    NOT NULL DEFAULT 0,
      x_penalty   REAL    NOT NULL DEFAULT 0,
      aa_penalty  REAL    NOT NULL DEFAULT 0,
      ab_penalty  REAL    NOT NULL DEFAULT 0,
      ac_penalty  REAL    NOT NULL DEFAULT 0,
      ad_penalty  REAL    NOT NULL DEFAULT 0,
      ae_penalty  REAL    NOT NULL DEFAULT 0,
      af_penalty  REAL    NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(train_no, date)
    )
  `)
}
