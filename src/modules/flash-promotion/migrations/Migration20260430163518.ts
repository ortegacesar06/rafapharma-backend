import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260430163518 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "flash_promotion" drop constraint if exists "flash_promotion_promotion_id_unique";`);
    this.addSql(`create table if not exists "flash_promotion" ("id" text not null, "promotion_id" text not null, "units_limit" integer null, "units_sold" integer not null default 0, "notify_on_activate" boolean not null default false, "notification_segment" text null, "notified_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "flash_promotion_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_flash_promotion_promotion_id_unique" ON "flash_promotion" ("promotion_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_flash_promotion_deleted_at" ON "flash_promotion" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "flash_promotion" cascade;`);
  }

}
