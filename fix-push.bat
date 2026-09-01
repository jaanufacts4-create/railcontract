@echo off
cd /d D:\Projects\Contracts\railpay
if exist .git\HEAD.lock del .git\HEAD.lock

REM Dirty-Fresh register fixes + Edit functionality
git add "app/(app)/laundry/dirty-fresh/page.tsx"
git add "app/(app)/laundry/page.tsx"
git add "app/api/laundry/raw-data/[id]/route.ts"
git add "app/api/laundry/fresh-data/[id]/route.ts"
git add "app/(app)/laundry/raw-data/[id]/edit/page.tsx"
git add "app/(app)/laundry/fresh-data/[id]/edit/page.tsx"

REM Reports + Excel export
git add "app/api/laundry/export/route.ts"
git add "app/(app)/laundry/reports/page.tsx"

REM Inspections module
git add "lib/db.ts"
git add "app/api/inspections/route.ts"
git add "app/api/inspections/[id]/route.ts"
git add "app/api/inspections/inspectors/route.ts"
git add "app/api/inspections/pivot/route.ts"
git add "app/(app)/laundry/inspections/page.tsx"
git add "app/(app)/laundry/inspections/new/page.tsx"
git add "app/(app)/laundry/inspections/[id]/edit/page.tsx"

REM Inspection Notes sub-module
git add "app/api/inspection-notes/route.ts"
git add "app/api/inspection-notes/[id]/route.ts"
git add "app/(app)/laundry/inspection-notes/page.tsx"
git add "app/(app)/laundry/inspection-notes/new/page.tsx"
git add "app/(app)/laundry/inspection-notes/[id]/edit/page.tsx"

REM Damaged Linen sub-module
git add "app/api/damaged-linen/rates/route.ts"
git add "app/api/damaged-linen/route.ts"
git add "app/api/damaged-linen/[id]/route.ts"
git add "app/(app)/laundry/damaged-linen/page.tsx"
git add "app/(app)/laundry/damaged-linen/settings/page.tsx"
git add "app/(app)/laundry/damaged-linen/new/page.tsx"

REM Store Inspections sub-module
git add "app/api/store-inspections/route.ts"
git add "app/api/store-inspections/[id]/route.ts"
git add "app/(app)/laundry/store-inspections/page.tsx"

REM Sidebar update
git add "components/Sidebar.tsx"

REM Pivot fix + rename + Penalties tab + reports
git add "app/api/inspections/pivot/route.ts"
git add "app/(app)/laundry/inspections/page.tsx"
git add "app/(app)/laundry/reports/page.tsx"
git add "app/api/laundry/penalties-export/route.ts"

git add "app/(app)/laundry/damaged-linen/page.tsx"

git commit -m "laundry: penalties export single-sheet portrait layout (Total A/B/A+B), damaged linen item name dark mode fix"

REM Contract Documents module
git add "lib/db.ts"
git add "app/api/contract-docs/route.ts"
git add "app/api/contract-docs/[id]/route.ts"
git add "app/(app)/documents/page.tsx"

git commit -m "feat: contract documents — upload/view/delete GEM, Tender, Agreement PDFs per contractor"

REM Add Other Docs + Vercel Blob PDF storage migration
git add "package.json"
git add "package-lock.json"
git add "lib/db.ts"
git add "app/(app)/documents/page.tsx"
git add "app/api/contract-docs/route.ts"
git add "app/api/contract-docs/[id]/route.ts"
git commit -m "feat: migrate PDF storage to Vercel Blob, add Other Docs slot"

REM Dirty Linen form — table layout
git add "app/(app)/laundry/raw-data/new/page.tsx"
git commit -m "ui: dirty linen entry form — table/columnar layout"

REM Petty Bill — Form E-1337
git add "lib/db.ts"
git add "app/api/laundry/petty/preview/route.ts"
git add "app/api/laundry/petty/generate/route.ts"
git add "app/(app)/laundry/petty/page.tsx"
git add "app/(app)/laundry/reports/page.tsx"
git commit -m "feat: petty bill E-1337 — auto-fill, verify, 2-page portrait A4 Excel"

REM Penalty summary — Portrait A4 layout + compact reports page
git add "app/api/laundry/penalties-export/route.ts"
git add "app/api/laundry/penalty-summary/generate/route.ts"
git add "app/(app)/laundry/reports/page.tsx"
git commit -m "feat: penalty summary — portrait A4, penalties below qty table, 13-col layout; reports page compact 3-tab UI; penalties register has Sheet 5 summary"

REM Fix: Summary of Penalty as separate tab, removed from Penalties Register
git add "app/api/laundry/penalties-export/route.ts"
git add "app/(app)/laundry/reports/page.tsx"
git commit -m "fix: summary of penalty — own tab in reports, removed sheet from penalties register"

REM Fix: Laundry Register — SUM formula off-by-one (last row missed due to mergeCells A2:A3)
git add "app/api/laundry/export/route.ts"
git commit -m "fix: laundry register SUM formula — dynamic row tracking, last entry no longer missed"

REM Laundry Settings page
git add "lib/db.ts"
git add "app/api/laundry/settings/route.ts"
git add "app/(app)/laundry/settings/page.tsx"
git add "components/Sidebar.tsx"
git commit -m "feat: laundry settings — contractor details, current rates, LOA qty + increase %, cumulative opening qty"

REM Petty Bill generate — row 14 auto-height, A/B/C22 unmerge with cumulative data, H/I22 unmerge, SS2 col L
git add "app/api/laundry/petty/generate/route.ts"
git commit -m "fix: petty bill — row14 auto-height, A/B/C22 split (as per last/since/upto), H/I22 split, SS2 col L added"

REM Petty Bill — full rewrite to match Petty.xlsx reference exactly
REM 14 cols A-N, correct row heights, 3-row payment header R21-R23, items R13-R19, financial R32-R39, page 2 at R56
git add "app/api/laundry/petty/generate/route.ts"
git commit -m "fix: petty bill generate — exact match Petty.xlsx: 14-col A-N, correct merges, row heights, payment table 3-row header, financial summary R32-R39, page2 at R56"
git push
echo.
echo Done! Press any key to close.
pause
