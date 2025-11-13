import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Create sources table
  await db.schema
    .createTable("sources")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().notNull().autoIncrement(),
    )
    .addColumn("source_id", "text", (col) => col.notNull())
    .addColumn("display_name", "text", (col) => col.notNull().defaultTo(""))
    .addColumn("parameter", "text", (col) => col.notNull().defaultTo("{}"))
    .addColumn("created_at", "integer", (col) =>
      col.notNull().defaultTo(sql`(unixepoch('now', 'subsec') * 1000)`),
    )
    .addColumn("updated_at", "integer", (col) =>
      col.notNull().defaultTo(sql`(unixepoch('now', 'subsec') * 1000)`),
    )
    .execute();

  // Create index on source_id field
  await db.schema
    .createIndex("sources_source_id_idx")
    .on("sources")
    .column("source_id")
    .execute();

  // Create FTS5 contentless-delete table for searchable fields
  await sql`
		CREATE VIRTUAL TABLE sources_fts USING fts5(
			source_id,
			display_name,
			parameter,
			content='',
			contentless_delete=1
		)
	`.execute(db);

  // Trigger to auto-update updated_at on update
  await sql`
		CREATE TRIGGER sources_updated_at_trigger
		AFTER UPDATE ON sources
		FOR EACH ROW
		BEGIN
			UPDATE sources
			SET updated_at = (unixepoch('subsec') * 1000)
			WHERE id = NEW.id;
		END
	`.execute(db);

  // Trigger to sync FTS5 table on insert
  await sql`
		CREATE TRIGGER sources_fts_insert_trigger
		AFTER INSERT ON sources
		BEGIN
			INSERT INTO sources_fts(rowid, source_id, display_name, parameter)
			VALUES (NEW.id, NEW.source_id, NEW.display_name, NEW.parameter);
		END
	`.execute(db);

  // Trigger to sync FTS5 table on update
  await sql`
		CREATE TRIGGER sources_fts_update_trigger
		AFTER UPDATE ON sources
		BEGIN
			UPDATE sources_fts
			SET source_id = NEW.source_id,
			    display_name = NEW.display_name,
			    parameter = NEW.parameter
			WHERE rowid = NEW.id;
		END
	`.execute(db);

  // Trigger to sync FTS5 table on delete
  await sql`
		CREATE TRIGGER sources_fts_delete_trigger
		AFTER DELETE ON sources
		BEGIN
			DELETE FROM sources_fts WHERE rowid = OLD.id;
		END
	`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop triggers
  await sql`DROP TRIGGER IF EXISTS sources_fts_delete_trigger`.execute(db);
  await sql`DROP TRIGGER IF EXISTS sources_fts_update_trigger`.execute(db);
  await sql`DROP TRIGGER IF EXISTS sources_fts_insert_trigger`.execute(db);
  await sql`DROP TRIGGER IF EXISTS sources_updated_at_trigger`.execute(db);

  // Drop FTS5 table
  await sql`DROP TABLE IF EXISTS sources_fts`.execute(db);

  // Drop index
  await db.schema.dropIndex("sources_source_id_idx").execute();

  // Drop table
  await db.schema.dropTable("sources").execute();
}
