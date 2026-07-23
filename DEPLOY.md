# RailPay — Deploy Guide

## One-time setup

### 1. GitHub
```bash
git init
git add .
git commit -m "init"
# Create repo on github.com, then:
git remote add origin https://github.com/<you>/railpay.git
git push -u origin main
```

### 2. Turso database
```bash
npm install -g @turso/cli
turso auth login
turso db create railpay
turso db show railpay          # note the URL
turso db tokens create railpay # note the token
```

### 3. .env.local (local dev only — never commit this)
```
TURSO_DATABASE_URL=libsql://railpay-<yourname>.turso.io
TURSO_AUTH_TOKEN=<token from step 2>
```

### 4. Run migration (creates all tables + seeds config)
```bash
npm install
npm run db:migrate
```

### 5. Vercel
- Go to vercel.com → New Project → Import your GitHub repo
- Add Environment Variables (same as .env.local):
  - `TURSO_DATABASE_URL`
  - `TURSO_AUTH_TOKEN`
- Deploy → done.

## Local dev
```bash
npm run dev   # http://localhost:3000
```

## Updating minimum wages
Settings page → Minimum Wages/day → update → Save.
All future penalty calculations use the new value.

## Updating train composition
Train Master page → select train → edit coach types → Save.
Do this if Railway changes the rake composition for a month.
