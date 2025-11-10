import { defineConfig } from "kysely-ctl";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { Database } from "bun:sqlite";

export default defineConfig({
  // replace me with a real dialect instance OR a dialect name + `dialectConfig` prop.
  dialect: new BunSqliteDialect({
    database: new Database(process.env.DATABASE_URL || ":memory:"),
  }),
  migrations: {
    migrationFolder: "src/migrations",
  },
});
