@echo off
cd /d D:\Projects\Contracts\railpay
if exist .git\HEAD.lock del .git\HEAD.lock

REM -- Core / shared
git add "lib/db.ts"
git add "components/Sidebar.tsx"

REM -- Primary billing
git add "app/(app)/billing/page.tsx"
git add "app/(app)/settings/page.tsx"
git add "app/api/config/route.ts"

REM -- Nirmal pages
git add "app/(app)/nirmal/billing/page.tsx"
git add "app/(app)/nirmal/trips/page.tsx"
git add "app/(app)/nirmal/trips/new/page.tsx"
git add "app/(app)/nirmal/trips/[id]/edit/page.tsx"
git add "app/(app)/nirmal/obhs/page.tsx"
git add "app/(app)/nirmal/settings/page.tsx"
git add "app/(app)/nirmal/reports/page.tsx"
git add "app/(app)/nirmal/schedule/page.tsx"

REM -- Nirmal API routes
git add "app/api/nirmal/trips/route.ts"
git add "app/api/nirmal/trips/[id]/route.ts"
git add "app/api/nirmal/obhs/route.ts"
git add "app/api/nirmal/obhs/upload/route.ts"
git add "app/api/nirmal/billing/preview/route.ts"
git add "app/api/nirmal/billing/generate/route.ts"
git add "app/api/nirmal/billing/cumulative/route.ts"
git add "app/api/nirmal/schedule/route.ts"

git commit -m "feat: Nirmal schedule tab - separate train schedule with Import from Primary"
git push
echo.
echo Done! Press any key to close.
pause
