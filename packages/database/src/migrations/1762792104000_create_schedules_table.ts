import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Create schedules table
  await db.schema
    .createTable("schedules")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().notNull().autoIncrement(),
    )
    .addColumn("source_id", "integer", (col) =>
      col.notNull().references("sources.id").onDelete("cascade"),
    )
    .addColumn("disabled", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("schedule", "text", (col) => col.notNull())
    .addColumn("created_at", "integer", (col) =>
      col.notNull().defaultTo(sql`(unixepoch('now', 'subsec') * 1000)`),
    )
    .addColumn("updated_at", "integer", (col) =>
      col.notNull().defaultTo(sql`(unixepoch('now', 'subsec') * 1000)`),
    )
    .execute();

  // Create index on source_id field
  await db.schema
    .createIndex("schedules_source_id_idx")
    .on("schedules")
    .column("source_id")
    .execute();

  // Trigger to auto-update updated_at on update
  await sql`
		CREATE TRIGGER schedules_updated_at_trigger
		AFTER UPDATE ON schedules
		FOR EACH ROW
		BEGIN
			UPDATE schedules
			SET updated_at = (unixepoch('subsec') * 1000)
			WHERE id = NEW.id;
		END
	`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop trigger
  await sql`DROP TRIGGER IF EXISTS schedules_updated_at_trigger`.execute(db);

  // Drop index
  await db.schema.dropIndex("schedules_source_id_idx").execute();

  // Drop table
  await db.schema.dropTable("schedules").execute();
}
