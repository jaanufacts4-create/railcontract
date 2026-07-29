import { NextRequest, NextResponse } from 'next/server'
import { db, ensureDB } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureDB()
  const { id } = await params
  const b = await req.json()
  const { ehk_present, ac_short, nac_short, psi_pct,
          w_penalty, x_penalty,
          aa_penalty, ab_penalty, ac_penalty, ad_penalty, ae_penalty, af_penalty } = b
  await db.execute({
    sql: `UPDATE obhs_entries SET
            ehk_present=?, ac_short=?, nac_short=?, psi_pct=?,
            w_penalty=?, x_penalty=?,
            aa_penalty=?, ab_penalty=?, ac_penalty=?, ad_penalty=?, ae_penalty=?, af_penalty=?
          WHERE id=?`,
    args: [ehk_present, ac_short, nac_short, psi_pct,
           w_penalty, x_penalty,
           aa_penalty, ab_penalty, ac_penalty, ad_penalty, ae_penalty, af_penalty,
           id],
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureDB()
  const { id } = await params
  await db.execute({ sql: 'DELETE FROM obhs_entries WHERE id=?', args: [id] })
  return NextResponse.json({ ok: true })
}
