import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260426215858 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "warehouse_service_area" drop constraint if exists "warehouse_service_area_stock_location_id_canton_id_unique";`);
    this.addSql(`create table if not exists "warehouse_service_area" ("id" text not null, "stock_location_id" text not null, "canton_id" text not null, "priority" integer not null default 100, "surcharge_amount" numeric not null default 0, "raw_surcharge_amount" jsonb not null default '{"value":"0","precision":20}', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "warehouse_service_area_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_warehouse_service_area_stock_location_id" ON "warehouse_service_area" ("stock_location_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_warehouse_service_area_canton_id" ON "warehouse_service_area" ("canton_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_warehouse_service_area_deleted_at" ON "warehouse_service_area" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_warehouse_service_area_stock_location_id_canton_id_unique" ON "warehouse_service_area" ("stock_location_id", "canton_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "warehouse_service_area" cascade;`);
  }

}
