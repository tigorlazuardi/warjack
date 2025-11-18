import type { Kysely } from "kysely";
import { sql } from "kysely";

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function up(db: Kysely<any>): Promise<void> {
	// Create images_devices junction table
	await db.schema
		.createTable("images_devices")
		.addColumn("image_id", "integer", (col) =>
			col.notNull().references("images.id").onDelete("cascade"),
		)
		.addColumn("device_id", "integer", (col) =>
			col.notNull().references("devices.id").onDelete("cascade"),
		)
		.addColumn("created_at", "integer", (col) =>
			col.notNull().defaultTo(sql`(unixepoch('now', 'subsec') * 1000)`),
		)
		.execute();

	// Create composite index (forward direction) with unique constraint
	await db.schema
		.createIndex("images_devices_image_device_idx")
		.on("images_devices")
		.columns(["image_id", "device_id"])
		.unique()
		.execute();

	// Create composite index (reverse direction)
	await db.schema
		.createIndex("images_devices_device_image_idx")
		.on("images_devices")
		.columns(["device_id", "image_id"])
		.execute();
}

// `any` is required here since migrations should be frozen in time. alternatively, keep a "snapshot" db interface.
export async function down(db: Kysely<any>): Promise<void> {
	// Drop indexes
	await db.schema.dropIndex("images_devices_device_image_idx").execute();
	await db.schema.dropIndex("images_devices_image_device_idx").execute();

	// Drop table
	await db.schema.dropTable("images_devices").execute();
}
