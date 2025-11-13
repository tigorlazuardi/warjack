import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // Create devices_sources junction table
  await db.schema
    .createTable("devices_sources")
    .addColumn("device_id", "integer", (col) =>
      col.notNull().references("devices.id").onDelete("cascade"),
    )
    .addColumn("source_id", "integer", (col) =>
      col.notNull().references("sources.id").onDelete("cascade"),
    )
    .addColumn("created_at", "integer", (col) =>
      col.notNull().defaultTo(sql`(unixepoch('now', 'subsec') * 1000)`),
    )
    .execute();

  // Create composite index (device_id, source_id)
  await db.schema
    .createIndex("devices_sources_device_source_idx")
    .on("devices_sources")
    .columns(["device_id", "source_id"])
    .unique()
    .execute();

  // Create composite index (source_id, device_id) for reverse lookup
  await db.schema
    .createIndex("devices_sources_source_device_idx")
    .on("devices_sources")
    .columns(["source_id", "device_id"])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop indexes
  await db.schema.dropIndex("devices_sources_source_device_idx").execute();
  await db.schema.dropIndex("devices_sources_device_source_idx").execute();

  // Drop table
  await db.schema.dropTable("devices_sources").execute();
}
