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
let _laundryMigrated       = false
let _inspectionMigrated    = false
let _inspectionModulesMigrated = false
let _contractDocsMigrated  = false
let _blobMigrated          = false
let _pettyMigrated         = false
let _laundrySettingsMigrated = false
let _trainSettingsMigrated   = false
let _mccMonthlyTotalsMigrated = false
let _monthlyBillsMigrated  = false
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
  if (!_monthlyBillsMigrated) {
    await migrateMonthlyBills()
    _monthlyBillsMigrated = true
  }
  if (!_obhsScheduleMigrated) {
    await migrateOBHSSchedule()
    _obhsScheduleMigrated = true
  }
  if (!_nirmalObhsMigrated) {
    await migrateNirmalOBHS()
    _nirmalObhsMigrated = true
  }
  if (!_laundryMigrated) {
    await migrateLaundry()
    _laundryMigrated = true
  }
  if (!_inspectionMigrated) {
    await migrateInspections()
    _inspectionMigrated = true
  }
  if (!_inspectionModulesMigrated) {
    await migrateInspectionModules()
    _inspectionModulesMigrated = true
  }
  if (!_contractDocsMigrated) {
    await migrateContractDocs()
    _contractDocsMigrated = true
  }
  if (!_blobMigrated) {
    await migrateBlobColumn()
    _blobMigrated = true
  }
  if (!_pettyMigrated) {
    await migratePetty()
    _pettyMigrated = true
  }
  if (!_laundrySettingsMigrated) {
    await migrateLaundrySettings()
    _laundrySettingsMigrated = true
  }
  if (!_trainSettingsMigrated) {
    await migrateTrainSettings()
    _trainSettingsMigrated = true
  }
  if (!_mccMonthlyTotalsMigrated) {
    await migrateMccMonthlyTotals()
    _mccMonthlyTotalsMigrated = true
  }
  // NOTE: ensureIndexes() is NOT called here to avoid Vercel timeout on cold start.
  // Call it once manually via: GET /api/admin/ensure-indexes
}

let _indexesEnsured = false

/** Create all performance indexes — each in its own try/catch so one failure never blocks login. */
async function ensureIndexes() {
  const INDEXES: [string, string][] = [
    // Most critical — dashboard JOIN was causing ~20M row reads per load
    ['idx_coach_scores_trip',      'ON coach_scores(trip_id)'],
    ['idx_train_master_no_pos',    'ON train_master(train_no, position)'],
    ['idx_trips_month',            'ON trips(month_year)'],
    ['idx_trips_train',            'ON trips(train_no)'],
    // Other primary tables
    ['idx_intensive_trip',         'ON intensive_scores(trip_id)'],
    ['idx_annex_penalties_trip',   'ON annex_penalties(trip_id)'],
    ['idx_manpower_trip',          'ON manpower(trip_id)'],
    // Secondary
    ['idx_sec_trips_month',        'ON sec_trips(month_year)'],
    ['idx_sec_trips_train',        'ON sec_trips(train_no)'],
    ['idx_sec_coach_ratings_trip', 'ON sec_coach_ratings(trip_id)'],
    ['idx_sec_annex_trip',         'ON sec_annex_b(trip_id)'],
    // Nirmal
    ['idx_nirmal_trips_month',     'ON nirmal_trips(month_year)'],
    ['idx_nirmal_trips_train',     'ON nirmal_trips(train_no)'],
    ['idx_nirmal_coach_trip',      'ON nirmal_coach_scores(trip_id)'],
    ['idx_nirmal_intensive_trip',  'ON nirmal_intensive_scores(trip_id)'],
    ['idx_nirmal_manpower_trip',   'ON nirmal_manpower(trip_id)'],
    ['idx_nirmal_annex_trip',      'ON nirmal_annex_penalties(trip_id)'],
    // OBHS
    ['idx_obhs_entries_month',     'ON obhs_entries(month_year)'],
    ['idx_obhs_entries_train',     'ON obhs_entries(train_no)'],
    ['idx_nirmal_obhs_month',      'ON nirmal_obhs_entries(month_year)'],
    ['idx_nirmal_obhs_train',      'ON nirmal_obhs_entries(train_no)'],
    // Laundry
    ['idx_laundry_raw_month',      'ON laundry_raw_data(month_year)'],
    ['idx_laundry_fresh_month',    'ON laundry_fresh_data(month_year)'],
    // Inspections
    ['idx_inspections_month',      'ON inspections(month_year)'],
    ['idx_insp_items_insp',        'ON inspection_items(inspection_id)'],
    ['idx_insp_notes_month',       'ON inspection_notes(month_year)'],
    ['idx_damaged_linen_month',    'ON damaged_linen_entries(month_year)'],
    ['idx_damaged_items_entry',    'ON damaged_linen_items(entry_id)'],
    ['idx_store_insp_month',       'ON store_inspections(month_year)'],
  ]
  // Each index in its own try/catch — if a table doesn't exist yet, skip silently
  for (const [name, definition] of INDEXES) {
    try {
      await db.execute(`CREATE INDEX IF NOT EXISTS ${name} ${definition}`)
    } catch { /* table may not exist in this DB version — safe to skip */ }
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

    -- ── Train Settings (per-train overrides) ─────────────────────────
    CREATE TABLE IF NOT EXISTS train_settings (
      train_no    TEXT PRIMARY KEY,
      required_mp INTEGER          -- fixed MP override; NULL = use 0.38 formula
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

  // Safe column addition: int_acwp on trips (0=exterior shown, 1=ACWP/no exterior)
  try {
    await db.execute('ALTER TABLE trips ADD COLUMN int_acwp INTEGER NOT NULL DEFAULT 0')
  } catch { /* column already exists — ignore */ }

  // Safe column addition: individual criteria cells on coach_scores
  for (const col of ['c0','c1','c2','c3','c4']) {
    try {
      await db.execute(`ALTER TABLE coach_scores ADD COLUMN ${col} INTEGER NOT NULL DEFAULT 0`)
    } catch { /* column already exists — ignore */ }
  }
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

/** ─── Departmental Laundry ───────────────────────────────────────────────── */
async function migrateLaundry() {
  // Dirty linen dispatched
  await db.execute(`
    CREATE TABLE IF NOT EXISTS laundry_raw_data (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      date                TEXT    NOT NULL,
      month_year          TEXT    NOT NULL,
      depot               TEXT    NOT NULL DEFAULT 'ASR',
      bed_sheet_normal    INTEGER NOT NULL DEFAULT 0,
      bed_sheet_1ac       INTEGER NOT NULL DEFAULT 0,
      pillow_cover_normal INTEGER NOT NULL DEFAULT 0,
      pillow_cover_1ac    INTEGER NOT NULL DEFAULT 0,
      face_towel          INTEGER NOT NULL DEFAULT 0,
      bath_towel          INTEGER NOT NULL DEFAULT 0,
      blanket_cover       INTEGER NOT NULL DEFAULT 0,
      blanket             INTEGER NOT NULL DEFAULT 0,
      canvas_bag          INTEGER NOT NULL DEFAULT 0,
      created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(date, depot)
    )
  `)
  // Fresh (washed) linen received
  await db.execute(`
    CREATE TABLE IF NOT EXISTS laundry_fresh_data (
      id                       INTEGER PRIMARY KEY AUTOINCREMENT,
      date                     TEXT    NOT NULL,
      month_year               TEXT    NOT NULL,
      depot                    TEXT    NOT NULL DEFAULT 'ASR',
      bed_sheet_fresh          INTEGER NOT NULL DEFAULT 0,
      bed_sheet_condemned      INTEGER NOT NULL DEFAULT 0,
      pillow_cover_fresh       INTEGER NOT NULL DEFAULT 0,
      pillow_cover_condemned   INTEGER NOT NULL DEFAULT 0,
      face_towel_fresh         INTEGER NOT NULL DEFAULT 0,
      face_towel_condemned     INTEGER NOT NULL DEFAULT 0,
      blanket_fresh            INTEGER NOT NULL DEFAULT 0,
      blanket_condemned        INTEGER NOT NULL DEFAULT 0,
      canvas_bag_fresh         INTEGER NOT NULL DEFAULT 0,
      canvas_bag_condemned     INTEGER NOT NULL DEFAULT 0,
      packets                  INTEGER NOT NULL DEFAULT 0,
      created_at               TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(date, depot)
    )
  `)
}

async function migrateInspections() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS inspections (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      date          TEXT    NOT NULL,
      month_year    TEXT    NOT NULL,
      depot         TEXT    NOT NULL DEFAULT 'ASR',
      inspected_by  TEXT    NOT NULL,
      designation   TEXT    NOT NULL,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS inspection_items (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      inspection_id INTEGER NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
      item_name     TEXT    NOT NULL,
      lot_of        INTEGER NOT NULL DEFAULT 0,
      items_checked INTEGER NOT NULL DEFAULT 0,
      items_dirty   INTEGER NOT NULL DEFAULT 0,
      penalty       INTEGER NOT NULL DEFAULT 200,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `)
}

async function migrateInspectionModules() {
  // B. Inspection Notes
  await db.execute(`
    CREATE TABLE IF NOT EXISTS inspection_notes (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      date                  TEXT    NOT NULL,
      month_year            TEXT    NOT NULL,
      depot                 TEXT    NOT NULL DEFAULT 'ASR',
      inspected_by          TEXT    NOT NULL,
      remarks               TEXT    NOT NULL DEFAULT '',
      tool_short_count      INTEGER NOT NULL DEFAULT 0,
      cleanliness_fail      INTEGER NOT NULL DEFAULT 0,
      bedsheet_wrapping_qty INTEGER NOT NULL DEFAULT 0,
      created_at            TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Damaged Linen - rate settings (one row per item, upserted)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS damaged_linen_rates (
      item_name   TEXT PRIMARY KEY,
      rate        REAL NOT NULL DEFAULT 0
    )
  `)
  // Seed default rates (2015 rates @ 75% LPR)
  const defaults = [
    ['Bedsheet Handloom',       231.75],
    ['Bedsheet Polyvastra',     568.37],
    ['Pillow Cover Handloom',    41.48],
    ['Pillow Cover Polyvastra', 177.19],
    ['Face Towel',               35.21],
    ['Blanket',                 364.88],
  ]
  for (const [name, rate] of defaults) {
    await db.execute({
      sql:  `INSERT OR IGNORE INTO damaged_linen_rates (item_name, rate) VALUES (?, ?)`,
      args: [name, rate],
    })
  }

  // Damaged Linen entries
  await db.execute(`
    CREATE TABLE IF NOT EXISTS damaged_linen_entries (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      date       TEXT NOT NULL,
      month_year TEXT NOT NULL,
      depot      TEXT NOT NULL DEFAULT 'ASR',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS damaged_linen_items (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id  INTEGER NOT NULL REFERENCES damaged_linen_entries(id) ON DELETE CASCADE,
      item_name TEXT    NOT NULL,
      qty       INTEGER NOT NULL DEFAULT 0,
      rate      REAL    NOT NULL DEFAULT 0,
      penalty   REAL    NOT NULL DEFAULT 0
    )
  `)

  // Store Inspections
  await db.execute(`
    CREATE TABLE IF NOT EXISTS store_inspections (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      date         TEXT NOT NULL,
      month_year   TEXT NOT NULL,
      depot        TEXT NOT NULL DEFAULT 'ASR',
      inspected_by TEXT NOT NULL,
      amount       REAL NOT NULL DEFAULT 0,
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
}

/** ─── Contract Documents ────────────────────────────────────────────────────── */
async function migrateContractDocs() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS contract_documents (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id   TEXT    NOT NULL,
      doc_type      TEXT    NOT NULL,
      file_name     TEXT    NOT NULL,
      file_size     INTEGER NOT NULL DEFAULT 0,
      file_data     TEXT    NOT NULL DEFAULT '',
      uploaded_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(contract_id, doc_type)
    )
  `)
}

/** ─── Petty Bills (Form E-1337) ─────────────────────────────────────────── */
async function migratePetty() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS petty_bills (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      month_year          TEXT    NOT NULL UNIQUE,
      bill_no             INTEGER NOT NULL,
      bill_date           TEXT    NOT NULL,
      mb_no               TEXT    NOT NULL DEFAULT '',
      mb_pages            TEXT    NOT NULL DEFAULT '',
      work_from           TEXT    NOT NULL DEFAULT '',
      work_to             TEXT    NOT NULL DEFAULT '',

      bedsheet_washed     INTEGER NOT NULL DEFAULT 0,
      pillow_washed       INTEGER NOT NULL DEFAULT 0,
      face_towel_washed   INTEGER NOT NULL DEFAULT 0,
      blanket_washed      INTEGER NOT NULL DEFAULT 0,
      craft_bag_washed    INTEGER NOT NULL DEFAULT 0,
      canvas_bag_washed   INTEGER NOT NULL DEFAULT 0,

      bedsheet_no_pay     INTEGER NOT NULL DEFAULT 0,
      pillow_no_pay       INTEGER NOT NULL DEFAULT 0,
      face_towel_no_pay   INTEGER NOT NULL DEFAULT 0,
      blanket_no_pay      INTEGER NOT NULL DEFAULT 0,
      craft_bag_no_pay    INTEGER NOT NULL DEFAULT 0,
      canvas_bag_no_pay   INTEGER NOT NULL DEFAULT 0,

      bedsheet_upto_qty   INTEGER NOT NULL DEFAULT 0,
      pillow_upto_qty     INTEGER NOT NULL DEFAULT 0,
      face_towel_upto_qty INTEGER NOT NULL DEFAULT 0,
      blanket_upto_qty    INTEGER NOT NULL DEFAULT 0,
      craft_bag_upto_qty  INTEGER NOT NULL DEFAULT 0,
      canvas_bag_upto_qty INTEGER NOT NULL DEFAULT 0,

      penalty             REAL    NOT NULL DEFAULT 0,
      conservancy_cess    REAL    NOT NULL DEFAULT 785,
      created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Seed petty item rates into config (INSERT OR IGNORE — won't overwrite user changes)
  const PETTY_RATES = [
    ['petty_rate_bedsheet',   '6.66'],
    ['petty_rate_pillow',     '2.99'],
    ['petty_rate_face_towel', '2.99'],
    ['petty_rate_blanket',    '28.30'],
    ['petty_rate_craft_bag',  '2.90'],
    ['petty_rate_canvas_bag', '490.00'],
    ['petty_gst_pct',         '18'],
    ['petty_tax_pct',         '2'],
    ['petty_igst_pct',        '2'],
    ['petty_conservancy',     '785'],
  ]
  for (const [key, value] of PETTY_RATES) {
    await db.execute({
      sql:  `INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)`,
      args: [key, value],
    })
  }
}

/** ─── MCC Monthly Totals (shared between export & billing) ─────────────────── */
async function migrateMccMonthlyTotals() {
  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS mcc_monthly_totals (
      month_year TEXT PRIMARY KEY,
      norm_ac    INTEGER NOT NULL DEFAULT 0,
      norm_nac   INTEGER NOT NULL DEFAULT 0,
      norm_ext   INTEGER NOT NULL DEFAULT 0,
      norm_vb    INTEGER NOT NULL DEFAULT 0,
      int_ac     INTEGER NOT NULL DEFAULT 0,
      int_nac    INTEGER NOT NULL DEFAULT 0,
      int_ext    INTEGER NOT NULL DEFAULT 0,
      int_vb     INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`)
  } catch { /* ignore */ }
}

/** ─── Train Settings table (per-train MP override etc.) ────────────────────── */
async function migrateTrainSettings() {
  // Table is created via IF NOT EXISTS in schema, but add for existing DBs
  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS train_settings (
      train_no    TEXT PRIMARY KEY,
      required_mp INTEGER
    )`)
  } catch { /* ignore */ }
}

/** ─── Add file_url column (Vercel Blob migration) ────────────────────────── */
async function migrateBlobColumn() {
  try {
    await db.execute(`ALTER TABLE contract_documents ADD COLUMN file_url TEXT NOT NULL DEFAULT ''`)
  } catch { /* column already exists — ignore */ }
}

/** ─── Laundry Settings (contractor details, LOA qty, opening cumulative) ─── */
async function migrateLaundrySettings() {
  const DEFAULTS: [string, string][] = [
    // Contractor details (used in Petty Bill header)
    ['laundry_contractor_name',    'M/s Peyush Traders'],
    ['laundry_contractor_address', ''],
    ['laundry_work_name',          'Mechanized Washing of Linen Items at ASR & FZR Depot'],
    ['laundry_contract_no',        ''],
    ['laundry_agreement_no',       ''],
    ['laundry_mb_no',              '128195'],
    ['laundry_account_no',         ''],
    ['laundry_ifsc_code',          ''],

    // LOA quantities (as per Letter of Award)
    ['laundry_loa_bedsheet',   '0'],
    ['laundry_loa_pillow',     '0'],
    ['laundry_loa_face_towel', '0'],
    ['laundry_loa_blanket',    '0'],
    ['laundry_loa_canvas_bag', '0'],
    ['laundry_loa_craft_bag',  '0'],
    ['laundry_loa_increase_pct', '0'],   // 0 / 10 / 15 / 25

    // Opening cumulative quantities (pre-system data carry-forward)
    ['laundry_open_bedsheet',   '0'],
    ['laundry_open_pillow',     '0'],
    ['laundry_open_face_towel', '0'],
    ['laundry_open_blanket',    '0'],
    ['laundry_open_canvas_bag', '0'],
    ['laundry_open_craft_bag',  '0'],
  ]
  for (const [key, value] of DEFAULTS) {
    await db.execute({
      sql:  `INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)`,
      args: [key, value],
    })
  }
}
