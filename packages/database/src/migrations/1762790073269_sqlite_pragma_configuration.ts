import type { Kysely } from "kysely";
import { sql } from "kysely";

/**
 * SQLite PRAGMA Configuration Migration
 *
 * This migration sets up optimal SQLite pragma settings for performance,
 * reliability, and data integrity.
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Enable Write-Ahead Logging (WAL) mode for better concurrency
  // WAL allows readers and writers to work simultaneously
  await sql`PRAGMA journal_mode = WAL`.execute(db);

  // Set synchronous mode to NORMAL for good balance of safety and performance
  // NORMAL is safe for WAL mode and provides better performance than FULL
  await sql`PRAGMA synchronous = NORMAL`.execute(db);

  // Enable foreign key constraints
  // Must be set for each database connection
  await sql`PRAGMA foreign_keys = ON`.execute(db);

  // Set busy timeout to 5 seconds (5000ms)
  // Helps handle locked database situations
  await sql`PRAGMA busy_timeout = 5000`.execute(db);

  // Set cache size to approximately 64MB (-64000 means 64000 KB)
  // Negative value means KB, positive means pages
  await sql`PRAGMA cache_size = -64000`.execute(db);

  // Store temporary tables and indices in memory for better performance
  await sql`PRAGMA temp_store = MEMORY`.execute(db);

  // Enable memory-mapped I/O with 30GB limit for better read performance
  // Set to 0 to disable if you experience issues
  await sql`PRAGMA mmap_size = 30000000000`.execute(db);

  // Set page size to 4096 bytes (4KB)
  // Must be set before any tables are created
  // 4KB is a good default for modern systems
  await sql`PRAGMA page_size = 4096`.execute(db);

  // Auto-vacuum mode to incremental
  // Helps manage database file size automatically
  await sql`PRAGMA auto_vacuum = INCREMENTAL`.execute(db);

  // Increase journal size limit to 64MB
  // Helps with large transactions
  await sql`PRAGMA journal_size_limit = 67108864`.execute(db);
}

export async function down(_db: Kysely<any>): Promise<void> {
  // Do nothing
}
