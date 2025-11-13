import type { Kysely } from "kysely";
import { sql } from "kysely";

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function up(db: Kysely<any>): Promise<void> {
  // Create jobs table
  await db.schema
    .createTable("jobs")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().notNull().autoIncrement(),
    )
    .addColumn("topic", "text", (col) => col.notNull())
    .addColumn("payload", "text", (col) => col.notNull().defaultTo("{}"))
    .addColumn("status", "text", (col) => col.notNull().defaultTo("pending"))
    .addColumn("created_at", "integer", (col) =>
      col.notNull().defaultTo(sql`(unixepoch('subsec') * 1000)`),
    )
    .addColumn("updated_at", "integer", (col) =>
      col.notNull().defaultTo(sql`(unixepoch('subsec') * 1000)`),
    )
    .addColumn("started_at", "integer")
    .addColumn("completed_at", "integer")
    .addColumn("retry_count", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("max_retries", "integer", (col) => col.notNull().defaultTo(3))
    .addColumn("error_message", "text")
    .execute();

  // Create composite index for efficient job queries
  await db.schema
    .createIndex("jobs_topic_status_created_idx")
    .on("jobs")
    .columns(["topic", "status", "created_at"])
    .execute();

  // Trigger to auto-update updated_at on jobs update
  await sql`
		CREATE TRIGGER jobs_updated_at_trigger
		AFTER UPDATE ON jobs
		FOR EACH ROW
		BEGIN
			UPDATE jobs
			SET updated_at = (unixepoch('subsec') * 1000)
			WHERE id = NEW.id;
		END
	`.execute(db);

  // Create topic_locks table
  await db.schema
    .createTable("topic_locks")
    .addColumn("topic", "text", (col) => col.primaryKey().notNull())
    .addColumn("worker_id", "text", (col) => col.notNull())
    .addColumn("locked_at", "integer", (col) => col.notNull())
    .addColumn("heartbeat_at", "integer", (col) => col.notNull())
    .addColumn("current_job_id", "integer")
    .execute();

  // Create workers table
  await db.schema
    .createTable("workers")
    .addColumn("worker_id", "text", (col) => col.primaryKey().notNull())
    .addColumn("status", "text", (col) => col.notNull().defaultTo("idle"))
    .addColumn("last_heartbeat", "integer", (col) => col.notNull())
    .addColumn("current_topic", "text")
    .addColumn("created_at", "integer", (col) =>
      col.notNull().defaultTo(sql`(unixepoch('subsec') * 1000)`),
    )
    .execute();

  // Create index on worker status for quick idle worker lookup
  await db.schema
    .createIndex("workers_status_idx")
    .on("workers")
    .column("status")
    .execute();
}

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function down(db: Kysely<any>): Promise<void> {
  // Drop in reverse order
  await db.schema.dropTable("workers").execute();
  await db.schema.dropTable("topic_locks").execute();
  await sql`DROP TRIGGER IF EXISTS jobs_updated_at_trigger`.execute(db);
  await db.schema.dropTable("jobs").execute();
}
