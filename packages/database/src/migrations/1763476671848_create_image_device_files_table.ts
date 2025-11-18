import type { Kysely } from "kysely";
import { sql } from "kysely";

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function up(db: Kysely<any>): Promise<void> {
	// Create image_device_files table
	await db.schema
		.createTable("image_device_files")
		.addColumn("id", "integer", (col) =>
			col.primaryKey().autoIncrement().notNull(),
		)
		.addColumn("image_id", "integer", (col) =>
			col.notNull().references("images.id").onDelete("cascade"),
		)
		.addColumn("device_id", "integer", (col) =>
			col.notNull().references("devices.id").onDelete("cascade"),
		)
		.addColumn("file_path", "text", (col) => col.notNull().unique())
		.addColumn("created_at", "integer", (col) =>
			col.notNull().defaultTo(sql`(unixepoch('now', 'subsec') * 1000)`),
		)
		.execute();

	// Create composite index on (image_id, device_id) for faster lookups
	await db.schema
		.createIndex("image_device_files_image_device_idx")
		.on("image_device_files")
		.columns(["image_id", "device_id"])
		.execute();

	// Create index on file_path for faster unique constraint checks
	await db.schema
		.createIndex("image_device_files_file_path_idx")
		.on("image_device_files")
		.column("file_path")
		.execute();
}

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function down(db: Kysely<any>): Promise<void> {
	// Drop indexes
	await db.schema
		.dropIndex("image_device_files_file_path_idx")
		.execute();
	await db.schema
		.dropIndex("image_device_files_image_device_idx")
		.execute();

	// Drop table
	await db.schema.dropTable("image_device_files").execute();
}
