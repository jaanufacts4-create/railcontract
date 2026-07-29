import { NextRequest, NextResponse } from 'next/server'
import { ensureDB, db } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, ctx: Ctx) {
  await ensureDB()
  const { id } = await ctx.params
  const body = await req.json()
  const { ehk_present=1, ac_short=0, nac_short=0, psi_pct=0,
          w_penalty=0, x_penalty=0, aa_penalty=0, ab_penalty=0, ac_penalty=0,
          ad_penalty=0, ae_penalty=0, af_penalty=0 } = body
  await db.execute({
    sql: `UPDATE nirmal_obhs_entries SET ehk_present=?,ac_short=?,nac_short=?,psi_pct=?,
          w_penalty=?,x_penalty=?,aa_penalty=?,ab_penalty=?,ac_penalty=?,ad_penalty=?,ae_penalty=?,af_penalty=?
          WHERE id=?`,
    args: [ehk_present,ac_short,nac_short,psi_pct,w_penalty,x_penalty,
           aa_penalty,ab_penalty,ac_penalty,ad_penalty,ae_penalty,af_penalty,id],
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_: NextRequest, ctx: Ctx) {
  await ensureDB()
  const { id } = await ctx.params
  await db.execute({ sql: 'DELETE FROM nirmal_obhs_entries WHERE id=?', args: [id] })
  return NextResponse.json({ ok: true })
}
