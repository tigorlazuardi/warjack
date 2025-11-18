import type { Kysely } from "kysely";
import { sql } from "kysely";

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function up(db: Kysely<any>): Promise<void> {
	// Create images table
	await db.schema
		.createTable("images")
		.addColumn("id", "integer", (col) =>
			col.primaryKey().autoIncrement().notNull(),
		)
		.addColumn("source_id", "integer", (col) =>
			col.notNull().references("sources.id").onDelete("cascade"),
		)
		.addColumn("download_url", "text", (col) => col.notNull().unique())
		.addColumn("website_url", "text", (col) => col.notNull())
		.addColumn("height", "integer", (col) => col.notNull())
		.addColumn("width", "integer", (col) => col.notNull())
		.addColumn("author", "text")
		.addColumn("author_url", "text")
		.addColumn("title", "text")
		.addColumn("nsfw", "integer", (col) => col.notNull().defaultTo(0))
		.addColumn("created_at", "integer", (col) =>
			col.notNull().defaultTo(sql`(unixepoch('now', 'subsec') * 1000)`),
		)
		.addColumn("updated_at", "integer", (col) =>
			col.notNull().defaultTo(sql`(unixepoch('now', 'subsec') * 1000)`),
		)
		.execute();

	// Create index on source_id for faster foreign key lookups
	await db.schema
		.createIndex("images_source_id_idx")
		.on("images")
		.column("source_id")
		.execute();

	// Create index on download_url for faster unique constraint checks
	await db.schema
		.createIndex("images_download_url_idx")
		.on("images")
		.column("download_url")
		.execute();

	// Create FTS5 virtual table for full-text search on title, author, website_url
	await sql`
		CREATE VIRTUAL TABLE images_fts USING fts5(
			title,
			author,
			website_url,
			content='',
			contentless_delete=1
		)
	`.execute(db);

	// Create trigger to auto-update updated_at timestamp
	await sql`
		CREATE TRIGGER images_updated_at_trigger
		AFTER UPDATE ON images
		FOR EACH ROW
		BEGIN
			UPDATE images
			SET updated_at = (unixepoch('subsec') * 1000)
			WHERE id = NEW.id;
		END
	`.execute(db);

	// Create trigger to sync FTS5 table on insert
	await sql`
		CREATE TRIGGER images_fts_insert_trigger
		AFTER INSERT ON images
		BEGIN
			INSERT INTO images_fts(rowid, title, author, website_url)
			VALUES (NEW.id, NEW.title, NEW.author, NEW.website_url);
		END
	`.execute(db);

	// Create trigger to sync FTS5 table on update
	await sql`
		CREATE TRIGGER images_fts_update_trigger
		AFTER UPDATE ON images
		BEGIN
			UPDATE images_fts
			SET title = NEW.title,
				author = NEW.author,
				website_url = NEW.website_url
			WHERE rowid = NEW.id;
		END
	`.execute(db);

	// Create trigger to sync FTS5 table on delete
	await sql`
		CREATE TRIGGER images_fts_delete_trigger
		AFTER DELETE ON images
		BEGIN
			DELETE FROM images_fts WHERE rowid = OLD.id;
		END
	`.execute(db);
}

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function down(db: Kysely<any>): Promise<void> {
	// Drop triggers first
	await sql`DROP TRIGGER IF EXISTS images_fts_delete_trigger`.execute(db);
	await sql`DROP TRIGGER IF EXISTS images_fts_update_trigger`.execute(db);
	await sql`DROP TRIGGER IF EXISTS images_fts_insert_trigger`.execute(db);
	await sql`DROP TRIGGER IF EXISTS images_updated_at_trigger`.execute(db);

	// Drop FTS5 table
	await sql`DROP TABLE IF EXISTS images_fts`.execute(db);

	// Drop indexes
	await db.schema.dropIndex("images_download_url_idx").execute();
	await db.schema.dropIndex("images_source_id_idx").execute();

	// Drop main table
	await db.schema.dropTable("images").execute();
}
