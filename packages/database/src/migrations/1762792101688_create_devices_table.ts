import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Create devices table
  await db.schema
    .createTable("devices")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().notNull().autoIncrement(),
    )
    .addColumn("name", "text", (col) => col.notNull().defaultTo(""))
    .addColumn("disabled", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("height", "integer", (col) => col.notNull())
    .addColumn("width", "integer", (col) => col.notNull())
    .addColumn("image_ratio_delta_range", "real", (col) =>
      col.notNull().defaultTo(0.2),
    )
    .addColumn("min_image_height", "integer", (col) =>
      col.notNull().defaultTo(0),
    )
    .addColumn("max_image_height", "integer", (col) =>
      col.notNull().defaultTo(0),
    )
    .addColumn("min_image_width", "integer", (col) =>
      col.notNull().defaultTo(0),
    )
    .addColumn("max_image_width", "integer", (col) =>
      col.notNull().defaultTo(0),
    )
    .addColumn("min_image_filesize", "integer", (col) =>
      col.notNull().defaultTo(0),
    )
    .addColumn("max_image_filesize", "integer", (col) =>
      col.notNull().defaultTo(0),
    )
    .addColumn("nsfw", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "integer", (col) =>
      col.notNull().defaultTo(sql`(unixepoch('now', 'subsec' ) * 1000)`),
    )
    .addColumn("updated_at", "integer", (col) =>
      col.notNull().defaultTo(sql`(unixepoch('now', 'subsec') * 1000)`),
    )
    .execute();

  // Create index on name field
  await db.schema
    .createIndex("devices_name_idx")
    .on("devices")
    .column("name")
    .execute();

  // Create FTS5 contentless-delete table for name field (modern approach)
  await sql`
		CREATE VIRTUAL TABLE devices_fts USING fts5(
			name,
			content='',
			contentless_delete=1
		)
	`.execute(db);

  // Trigger to auto-update updated_at on update
  await sql`
		CREATE TRIGGER devices_updated_at_trigger
		AFTER UPDATE ON devices
		FOR EACH ROW
		BEGIN
			UPDATE devices
			SET updated_at = (unixepoch('subsec'))
			WHERE id = NEW.id;
		END
	`.execute(db);

  // Trigger to sync FTS5 table on insert
  await sql`
		CREATE TRIGGER devices_fts_insert_trigger
		AFTER INSERT ON devices
		BEGIN
			INSERT INTO devices_fts(rowid, name)
			VALUES (NEW.id, NEW.name);
		END
	`.execute(db);

  // Trigger to sync FTS5 table on update
  // Contentless-delete tables support UPDATE as long as all columns are provided
  await sql`
		CREATE TRIGGER devices_fts_update_trigger
		AFTER UPDATE ON devices
		BEGIN
			UPDATE devices_fts
			SET name = NEW.name
			WHERE rowid = NEW.id;
		END
	`.execute(db);

  // Trigger to sync FTS5 table on delete
  await sql`
		CREATE TRIGGER devices_fts_delete_trigger
		AFTER DELETE ON devices
		BEGIN
			DELETE FROM devices_fts WHERE rowid = OLD.id;
		END
	`.execute(db);
}
