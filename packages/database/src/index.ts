import { Kysely } from 'kysely'
import { BunSqliteDialect } from 'kysely-bun-sqlite'
import { Database as BunDatabase } from 'bun:sqlite'
import type { DB } from './schema'

// Create singleton database instance
const database = new Kysely<DB>({
  dialect: new BunSqliteDialect({
    database: new BunDatabase(process.env.DATABASE_URL || 'warjack.db'),
  }),
})

// Export database instance
export const db = database

// Export types
export type * from './schema'