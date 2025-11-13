import { Kysely } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { Database as BunDatabase } from "bun:sqlite";
import type { DB } from "./schema";

export function createClient() {
  // Create singleton database instance
  return new Kysely<DB>({
    dialect: new BunSqliteDialect({
      database: new BunDatabase(process.env.DATABASE_URL || "warjack.db"),
    }),
  });
}

// Export types
export type * from "./schema";
