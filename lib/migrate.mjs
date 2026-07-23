// Run with: node lib/migrate.mjs
// Make sure .env.local is loaded (or set env vars manually)
import { config } from 'dotenv'
config({ path: '.env.local' })

const { migrate } = await import('./db.ts').catch(() => import('./db.js'))
await migrate()
console.log('✅ Migration complete')
process.exit(0)
